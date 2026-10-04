import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { join, sep } from "node:path"

import { STATE_DIR, WORKER_DIR } from "./config.js"

/** `@zumda/core` is used by the seed script and the Worker. */
export function buildCore(): void {
    execFileSync("bun", ["run", "core"], { cwd: WORKER_DIR, stdio: "inherit" })
}

/**
 * Resets the stand's local D1 to the three demo shops (food, water, grocery). `migrate` once, on a
 * fresh database; later resets only replace the data (saves a wrangler run per spec).
 */
export function seed({ migrate = false }: { migrate?: boolean } = {}): void {
    const args = migrate ? ["scripts/seed-dev.ts"] : ["scripts/seed-dev.ts", "--data-only"]
    execFileSync("bun", args, {
        cwd: WORKER_DIR,
        stdio: "pipe",
        env: { ...process.env, ZUMDA_PERSIST_TO: STATE_DIR },
    })
}

/** One SQL statement on the stand's local D1 (tests that need time to pass, e.g. a wait). */
export function runSql(command: string): void {
    execFileSync(
        "bunx",
        [
            "wrangler",
            "d1",
            "execute",
            "zumda",
            "--local",
            "--persist-to",
            STATE_DIR,
            "--command",
            command,
        ],
        { cwd: WORKER_DIR, stdio: "pipe" },
    )
}

const MAP_DIR = join(import.meta.dirname, "map")

/**
 * The stand's map: a small piece around Yakkabog' (`scripts/map-data.mjs --bbox=... --out=...`),
 * with the label glyphs of Latin and Cyrillic and the icons, like production has them.
 */
export function loadMap(): void {
    const current = JSON.parse(readFileSync(join(MAP_DIR, "current.json"), "utf8")) as {
        file: string
    }
    // No spaces in R2 keys: "fonts/Noto Sans Regular/…" is stored as "fonts/noto-sans-regular/…".
    const put = (file: string): void => {
        const key = file.replace(
            /^fonts\/([^/]+)/,
            (_, font: string) => `fonts/${font.toLowerCase().replaceAll(" ", "-")}`,
        )
        execFileSync(
            "bunx",
            [
                "wrangler",
                "r2",
                "object",
                "put",
                `zumda-media/map/${key}`,
                `--file=${join(MAP_DIR, file)}`,
                "--local",
                "--persist-to",
                STATE_DIR,
            ],
            { cwd: WORKER_DIR, stdio: "pipe" },
        )
    }
    const files = readdirSync(MAP_DIR, { recursive: true, encoding: "utf8" })
        .filter((file) => /\.(pbf|json|png)$/.test(file) && file !== "current.json")
        .map((file) => file.split(sep).join("/"))
    for (const file of [current.file, ...files, "current.json"]) {
        put(file)
    }
}
