/**
 * Addresses and fixed data of the local stand. Everything here is fake and local-only:
 * the bot tokens never reach Telegram (the Worker talks to the fake Bot API below).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
    DEV_ADMIN_ID,
    DEV_COURIER,
    DEV_CUSTOMER,
    DEV_SHOPS,
} from "../../worker/scripts/dev-fixtures.js"

import type { DevShop } from "../../worker/scripts/dev-fixtures.js"

export const WORKER_DIR = join(import.meta.dirname, "..", "..", "worker")
export const APP_DIR = join(import.meta.dirname, "..", "..", "app")
/** The stand's own local D1/R2 state, separate from `wrangler dev` of a developer. */
export const STATE_DIR = join(import.meta.dirname, "..", ".state")

export const FAKE_TELEGRAM_PORT = 8081
export const WORKER_PORT = 8787
export const APP_PORT = 5173

export const FAKE_TELEGRAM_URL = `http://127.0.0.1:${FAKE_TELEGRAM_PORT}`
export const WORKER_URL = `http://localhost:${WORKER_PORT}`
/** Must match APP_ORIGIN in wrangler.jsonc: CORS allows only this origin. */
export const APP_URL = `http://localhost:${APP_PORT}`

export { DEV_ADMIN_ID, DEV_COURIER, DEV_CUSTOMER, DEV_SHOPS }
export type { DevShop }

/** Bot tokens the onboarding tests paste: `<bot id>:NEW-...`. The fake Telegram accepts them. */
export const NEW_BOT_TOKEN_PATTERN = /^(\d{6,12}):NEW-[\w-]{10,}$/

/** Values from the git-ignored `.dev.vars` that the seed script created. */
export function devVars(): Record<string, string> {
    const vars: Record<string, string> = {}
    const text = readFileSync(join(WORKER_DIR, ".dev.vars"), "utf8")
    for (const line of text.split("\n")) {
        const match = /^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(line)
        if (match?.[1]) {
            vars[match[1]] = match[2] ?? ""
        }
    }
    return vars
}

export function platformBot(): { token: string; secret: string; adminId: number } {
    const vars = devVars()
    return {
        token: vars["PLATFORM_BOT_TOKEN"] ?? "",
        secret: vars["PLATFORM_WEBHOOK_SECRET"] ?? "",
        adminId: DEV_ADMIN_ID,
    }
}

export function shopBySlug(slug: string): DevShop {
    const shop = DEV_SHOPS.find((s) => s.slug === slug)
    if (!shop) {
        throw new Error(`No dev shop ${slug}`)
    }
    return shop
}
