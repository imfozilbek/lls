import type { Services } from "./services.js"
import type { Business, IdentityScope, OrderChannel, TelegramUser } from "@lls/core"

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
    /** Which bot opened the app: the shop's own bot, or the LLS bot (showcase). */
    channel: OrderChannel
    /** How far the identity is trusted: a shop-signed one counts only inside that shop. */
    scope: IdentityScope
    /** The viewer's role in this shop; `customer` outside a shop and in the showcase. */
    role: ViewerRole
}

export type ViewerRole = "owner" | "courier" | "customer"

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
