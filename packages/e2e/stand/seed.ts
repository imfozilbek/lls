import { execFileSync } from "node:child_process"

import { STATE_DIR, WORKER_DIR } from "./config.js"

/** `@lls/core` is used by the seed script and the Worker. */
export function buildCore(): void {
    execFileSync("bun", ["run", "core"], { cwd: WORKER_DIR, stdio: "inherit" })
}

/** Resets the stand's local D1 to the three demo shops (food, water, grocery). */
export function seed(): void {
    execFileSync("bun", ["scripts/seed-dev.ts"], {
        cwd: WORKER_DIR,
        stdio: "pipe",
        env: { ...process.env, LLS_PERSIST_TO: STATE_DIR },
    })
}
