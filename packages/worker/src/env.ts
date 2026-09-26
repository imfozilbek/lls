import type { Services } from "./services.js"
import type { Business, TelegramUser } from "@lls/core"

/** Bindings from wrangler.jsonc plus secrets set with `wrangler secret put`. */
export interface Bindings extends Env {
    /** base64 of 32 random bytes; encrypts bot tokens at rest. */
    TOKEN_ENC_KEY: string
    PLATFORM_BOT_TOKEN: string
    PLATFORM_WEBHOOK_SECRET: string
    /** Comma-separated Telegram ids of platform admins. */
    PLATFORM_ADMIN_IDS: string
}

export interface AuthContext {
    user: TelegramUser
    /** The shop from `X-Shop`, or null when the platform bot opened the app (onboarding). */
    business: Business | null
    isOwner: boolean
}

export interface AppEnv {
    Bindings: Bindings
    Variables: {
        services: Services
        auth: AuthContext
    }
}

export function platformAdminIds(env: Bindings): number[] {
    return env.PLATFORM_ADMIN_IDS.split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
}
