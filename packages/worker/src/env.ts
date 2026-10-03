import type { Services } from "./services.js"
import type { Business, IdentityScope, OrderChannel, TelegramUser } from "@zumda/core"

/** Bindings from wrangler.jsonc plus secrets set with `wrangler secret put`. */
export interface Bindings extends Env {
    /** base64 of 32 random bytes; encrypts bot tokens at rest. */
    TOKEN_ENC_KEY: string
    PLATFORM_BOT_TOKEN: string
    PLATFORM_WEBHOOK_SECRET: string
    /** The Zumda courier bot: one bot for every courier of every shop. */
    COURIER_BOT_TOKEN: string
    COURIER_WEBHOOK_SECRET: string
    /**
     * The Zumda Biznes bot: owners' «Mening bizneslarim», applications, admins' commands; it
     * creates and manages the shops' bots (Telegram Managed Bots).
     */
    BUSINESS_BOT_TOKEN: string
    BUSINESS_WEBHOOK_SECRET: string
    /** Comma-separated Telegram ids of platform admins. */
    PLATFORM_ADMIN_IDS: string
    /** Local stand only: a fake Bot API on localhost. Never set in production. */
    TELEGRAM_API_BASE?: string
}

export interface AuthContext {
    user: TelegramUser
    /** The shop from `X-Shop`, or null when the platform bot opened the app (onboarding). */
    business: Business | null
    /** Which bot opened the app: the shop's own bot, or the Zumda bot (showcase). */
    channel: OrderChannel
    /** How far the identity is trusted: a shop-signed one counts only inside that shop. */
    scope: IdentityScope
    /**
     * The viewer's role: `owner` or `customer` in a shop; `courier` when the Zumda courier bot
     * opened the app (no shop: a courier works for several); `customer` in the showcase;
     * `business` in Zumda Biznes before a shop is opened.
     */
    role: ViewerRole
}

/** `business`: a person in the Zumda Biznes bot without a shop open («Mening bizneslarim»). */
export type ViewerRole = "owner" | "courier" | "customer" | "business"

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
