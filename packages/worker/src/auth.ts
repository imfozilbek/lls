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

import type { AppEnv, ViewerRole } from "./env.js"
import type { Services } from "./services.js"
import type { Business } from "@zumda/core"

export const INIT_DATA_HEADER = "X-Telegram-Init-Data"
export const SHOP_HEADER = "X-Shop"
/** `marketplace`: a shop opened from the Zumda showcase, inside the Zumda bot. */
export const VIA_HEADER = "X-Via"
export const VIA_MARKETPLACE = "marketplace"
/** `courier`: the Zumda courier bot opened the app (the courier's screen across their shops). */
export const BOT_HEADER = "X-Bot"
export const BOT_COURIER = "courier"

interface SignedBy {
    business: Business | null
    botToken: string
}

/** The shop from `X-Shop` and the token of the bot that must have signed the request. */
async function signerOf(
    services: Services,
    platformToken: string,
    slug: string | undefined,
    viaShowcase: boolean,
): Promise<SignedBy> {
    if (!slug) {
        return { business: null, botToken: platformToken }
    }
    const business = await services.businesses.findBySlug(slug)
    if (viaShowcase) {
        if (!business?.isInShowcase()) {
            throw EntityNotFoundError.businessBySlug(slug)
        }
        return { business, botToken: platformToken }
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
 * - `X-Bot: courier`: the Zumda courier bot (the courier's screen, no shop);
 * - nothing: the Zumda bot (onboarding, showcase search).
 * The token that verified the signature fixes the order channel, so the client cannot pick it.
 */
export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
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
    const viaShowcase = c.req.header(VIA_HEADER) === VIA_MARKETPLACE
    const { business, botToken } = await signerOf(
        services,
        c.env.PLATFORM_BOT_TOKEN,
        c.req.header(SHOP_HEADER),
        viaShowcase,
    )
    const verified = await verifyInitData(initData, botToken, services.clock.now())
    if (!verified) {
        throw unauthorized()
    }
    // The owner screen opens only from the shop's own bot.
    const role = business && !viaShowcase ? roleIn(business, verified.user.id) : "customer"
    // A shop that is not live yet is open to its owner only; a turned-off shop to nobody.
    if (business && !business.isActive() && (role !== "owner" || !business.isPending())) {
        throw EntityNotFoundError.businessBySlug(business.slug.value)
    }
    c.set("auth", {
        user: verified.user,
        business,
        channel: viaShowcase ? OrderChannel.MARKETPLACE : OrderChannel.SHOP_BOT,
        // The shop owner holds the shop bot token and could sign any user id with it.
        scope: business && !viaShowcase ? shopScope(business.id) : TRUSTED_SCOPE,
        role,
    })
    await next()
})

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
