import {
    EntityNotFoundError,
    ForbiddenError,
    OrderChannel,
    TRUSTED_SCOPE,
    shopScope,
} from "@zumda/core"
import { createMiddleware } from "hono/factory"

import { verifyInitData } from "./crypto.js"
import { ApiError, unauthorized } from "./http/errors.js"
import { bearerOf, readSession } from "./web-session.js"

import type { AppEnv, AuthContext, ViewerRole } from "./env.js"
import type { Services } from "./services.js"
import type { Business } from "@zumda/core"
import type { Context } from "hono"

export const INIT_DATA_HEADER = "X-Telegram-Init-Data"
/** `Bearer <session>`: Zumda | Business in a browser (business.zumda.shop), after the widget. */
export const AUTHORIZATION_HEADER = "Authorization"
export const SHOP_HEADER = "X-Shop"
/** `marketplace`: a shop opened from the Zumda showcase, inside the Zumda bot. */
export const VIA_HEADER = "X-Via"
export const VIA_MARKETPLACE = "marketplace"
/**
 * `courier`: the Zumda courier bot opened the app (the courier's screen across their shops).
 * `business`: the Zumda Business bot opened it («Mening bizneslarim», and an owner's own shop).
 */
export const BOT_HEADER = "X-Bot"
export const BOT_COURIER = "courier"
export const BOT_BUSINESS = "business"

/** Which bot opened the app, so which token must have signed it. */
type Entry = "shop" | typeof VIA_MARKETPLACE | typeof BOT_BUSINESS

interface EntryTokens {
    platform: string
    business: string
}

interface SignedBy {
    business: Business | null
    botToken: string
}

/** The shop from `X-Shop` and the token of the bot that must have signed the request. */
async function signerOf(
    services: Services,
    tokens: EntryTokens,
    slug: string | undefined,
    entry: Entry,
): Promise<SignedBy> {
    const zumdaToken = entry === BOT_BUSINESS ? tokens.business : tokens.platform
    if (!slug) {
        return { business: null, botToken: zumdaToken }
    }
    const business = await services.businesses.findBySlug(slug)
    if (entry === VIA_MARKETPLACE) {
        if (!business?.isInShowcase()) {
            throw EntityNotFoundError.businessBySlug(slug)
        }
        return { business, botToken: zumdaToken }
    }
    if (entry === BOT_BUSINESS) {
        if (!business) {
            throw EntityNotFoundError.businessBySlug(slug)
        }
        return { business, botToken: zumdaToken }
    }
    const credentials = business ? await services.businesses.getBotCredentials(business.id) : null
    if (!business || !credentials) {
        throw EntityNotFoundError.businessBySlug(slug)
    }
    return { business, botToken: credentials.token }
}

/**
 * Verifies Telegram initData with the token of the bot that opened the Mini App:
 * - `X-Shop` alone: the shop's own bot;
 * - `X-Shop` + `X-Via: marketplace`: the Zumda bot, and the shop must be in the showcase;
 * - `X-Bot: business`: the Zumda Business bot: «Mening bizneslarim» without `X-Shop`; with it,
 *   only the shop's owner gets in (else 403);
 * - `X-Bot: courier`: the Zumda courier bot (the courier's screen, no shop);
 * - nothing: the Zumda bot (showcase search).
 * The token that verified the signature fixes the order channel, so the client cannot pick it.
 */
export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
    const session = bearerOf(c.req.header(AUTHORIZATION_HEADER))
    if (session) {
        await authenticateSession(c, session)
        await next()
        return
    }
    const initData = c.req.header(INIT_DATA_HEADER)
    if (!initData) {
        throw unauthorized()
    }
    const services = c.get("services")
    if (c.req.header(BOT_HEADER) === BOT_COURIER) {
        const courier = await verifyInitData(
            initData,
            c.env.COURIER_BOT_TOKEN,
            services.clock.now(),
        )
        if (!courier) {
            throw unauthorized()
        }
        // Who they deliver for is decided per order and per shop, by their approved links.
        c.set("auth", {
            user: courier.user,
            business: null,
            channel: OrderChannel.SHOP_BOT,
            scope: TRUSTED_SCOPE,
            role: "courier",
        })
        await next()
        return
    }
    const entry = entryOf(c.req.header(BOT_HEADER), c.req.header(VIA_HEADER))
    const { business, botToken } = await signerOf(
        services,
        { platform: c.env.PLATFORM_BOT_TOKEN, business: c.env.BUSINESS_BOT_TOKEN },
        c.req.header(SHOP_HEADER),
        entry,
    )
    const verified = await verifyInitData(initData, botToken, services.clock.now())
    if (!verified) {
        throw unauthorized()
    }
    c.set("auth", { user: verified.user, business, ...accessIn(business, entry, verified.user.id) })
    await next()
})

/**
 * Zumda | Business in a browser: the session from the Telegram Login Widget stands for the same
 * person and the same rights as `X-Bot: business` (no shop: «Mening bizneslarim»; with `X-Shop`:
 * that shop's owner only).
 */
async function authenticateSession(c: Context<AppEnv>, token: string): Promise<void> {
    const services = c.get("services")
    const user = await readSession(token, c.env.BUSINESS_SESSION_SECRET, services.clock.now())
    if (!user) {
        throw unauthorized()
    }
    const slug = c.req.header(SHOP_HEADER)
    const business = slug ? await services.businesses.findBySlug(slug) : null
    if (slug && !business) {
        throw EntityNotFoundError.businessBySlug(slug)
    }
    c.set("auth", { user, business, ...accessIn(business, BOT_BUSINESS, user.id) })
}

function entryOf(bot: string | undefined, via: string | undefined): Entry {
    if (bot === BOT_BUSINESS) {
        return BOT_BUSINESS
    }
    return via === VIA_MARKETPLACE ? VIA_MARKETPLACE : "shop"
}

/** The role, channel and trust of a verified user in the shop they opened (if any). */
function accessIn(
    business: Business | null,
    entry: Entry,
    telegramId: number,
): Pick<AuthContext, "role" | "channel" | "scope"> {
    const viaShowcase = entry === VIA_MARKETPLACE
    if (!business) {
        // Zumda Business without a shop: «Mening bizneslarim» and applications.
        const role = entry === BOT_BUSINESS ? "business" : "customer"
        return { role, channel: OrderChannel.SHOP_BOT, scope: TRUSTED_SCOPE }
    }
    // The owner screen opens from the shop's own bot, or from Zumda Business for the owner only.
    const role = viaShowcase ? "customer" : roleIn(business, telegramId)
    if (entry === BOT_BUSINESS && role !== "owner") {
        throw ForbiddenError.notOwner(business.id)
    }
    // A shop waiting for approval opens to everyone (no orders yet); a turned-off or rejected
    // one only to its owner, who fixes it there.
    if (!business.isVisibleTo(telegramId)) {
        throw EntityNotFoundError.businessBySlug(business.slug.value)
    }
    return {
        role,
        channel: viaShowcase ? OrderChannel.MARKETPLACE : OrderChannel.SHOP_BOT,
        // The shop owner holds the shop bot token and could sign any user id with it; the Zumda
        // bots' signatures are trusted everywhere.
        scope: entry === "shop" ? shopScope(business.id) : TRUSTED_SCOPE,
    }
}

/** Owner by the shop record; everyone else is a customer (couriers use the courier bot). */
function roleIn(business: Business, telegramId: number): ViewerRole {
    return business.isOwnedBy(telegramId) ? "owner" : "customer"
}

/** The route works inside a shop (the app was opened from a shop bot). */
export function shopOf(c: { get(key: "auth"): AppEnv["Variables"]["auth"] }): Business {
    const { business } = c.get("auth")
    if (!business) {
        throw new ApiError(400, "SHOP_REQUIRED", `Send the ${SHOP_HEADER} header`)
    }
    return business
}

export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
    const business = shopOf(c)
    if (c.get("auth").role !== "owner") {
        throw ForbiddenError.notOwner(business.id)
    }
    await next()
})

/**
 * Opened from the Zumda courier bot. Whether they really deliver for a shop, the use cases check.
 */
export const requireCourier = createMiddleware<AppEnv>(async (c, next) => {
    if (c.get("auth").role !== "courier") {
        throw ForbiddenError.notACourier()
    }
    await next()
})
