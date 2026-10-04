/**
 * Starts the local stand: demo data in local D1, a fake Telegram Bot API, the Worker
 * (`wrangler dev`) and the Mini App (`vite`). Stops everything on Ctrl+C.
 *
 *   bun run stand          # from packages/e2e, or `bun run stand` from the repository root
 */
import { spawn } from "node:child_process"
import { rmSync } from "node:fs"

import {
    APP_DIR,
    APP_PORT,
    APP_URL,
    FAKE_TELEGRAM_PORT,
    FAKE_TELEGRAM_URL,
    STATE_DIR,
    WORKER_DIR,
    WORKER_PORT,
    WORKER_URL,
} from "./config.js"
import { startFakeTelegram } from "./fake-telegram.js"
import { buildCore, loadMap, seed } from "./seed.js"

import type { ChildProcess } from "node:child_process"

const STARTUP_TIMEOUT_MS = 120_000
const POLL_MS = 500

const children: ChildProcess[] = []

function start(command: string, args: string[], cwd: string): void {
    const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env })
    child.on("exit", (code) => {
        if (code !== null && code !== 0) {
            console.error(`${command} ${args.join(" ")} exited with ${code}`)
            stop(1)
        }
    })
    children.push(child)
}

function stop(code = 0): never {
    for (const child of children) {
        child.kill("SIGTERM")
    }
    process.exit(code)
}

async function waitFor(url: string): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url)
            if (response.ok) {
                return
            }
        } catch {
            // Not up yet.
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }
    throw new Error(`${url} did not start in ${STARTUP_TIMEOUT_MS / 1000} s`)
}

async function main(): Promise<void> {
    buildCore()
    // A fresh database on every start: the schema always matches the migrations.
    rmSync(STATE_DIR, { recursive: true, force: true })
    seed({ migrate: true })
    loadMap()
    await startFakeTelegram(FAKE_TELEGRAM_PORT)
    start(
        "bunx",
        [
            "wrangler",
            "dev",
            "--port",
            String(WORKER_PORT),
            "--persist-to",
            STATE_DIR,
            "--var",
            `TELEGRAM_API_BASE:${FAKE_TELEGRAM_URL}`,
            "--var",
            `TELEGRAM_OAUTH_BASE:${FAKE_TELEGRAM_URL}`,
            // Trips: the way along the "roads" of the fake OpenRouteService.
            "--var",
            "ORS_API_KEY:stand-ors-key",
            "--var",
            `ORS_API_BASE:${FAKE_TELEGRAM_URL}/ors`,
        ],
        WORKER_DIR,
    )
    start("bunx", ["vite", "--port", String(APP_PORT), "--strictPort"], APP_DIR)
    await waitFor(`${WORKER_URL}/health`)
    await waitFor(APP_URL)
    console.warn(`\nStand is up:\n  Mini App  ${APP_URL}\n  Worker    ${WORKER_URL}`)
    console.warn(`  Telegram  ${FAKE_TELEGRAM_URL}/__log (fake Bot API)\n`)
}

process.on("SIGINT", () => stop())
process.on("SIGTERM", () => stop())
main().catch((error: unknown) => {
    console.error(error)
    stop(1)
})
