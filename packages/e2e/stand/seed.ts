import { execFileSync } from "node:child_process"

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
