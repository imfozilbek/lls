import { EntityNotFoundError, ForbiddenError } from "@lls/core"
import { createMiddleware } from "hono/factory"

import { verifyInitData } from "./crypto.js"
import { ApiError, unauthorized } from "./http/errors.js"

import type { AppEnv, ViewerRole } from "./env.js"
import type { Services } from "./services.js"
import type { Business } from "@lls/core"

export const INIT_DATA_HEADER = "X-Telegram-Init-Data"
export const SHOP_HEADER = "X-Shop"

/**
 * Verifies Telegram initData with the token of the bot that opened the Mini App:
 * the shop's own bot when `X-Shop` is sent, otherwise the platform bot (onboarding).
 */
export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
    const initData = c.req.header(INIT_DATA_HEADER)
    if (!initData) {
        throw unauthorized()
    }
    const services = c.get("services")
    const slug = c.req.header(SHOP_HEADER)

    let business: Business | null = null
    let botToken = c.env.PLATFORM_BOT_TOKEN
    if (slug) {
        business = await services.businesses.findBySlug(slug)
        const credentials = business
            ? await services.businesses.getBotCredentials(business.id)
            : null
        if (!business || !credentials) {
            throw EntityNotFoundError.businessBySlug(slug)
        }
        botToken = credentials.token
    }

    const verified = await verifyInitData(initData, botToken, services.clock.now())
    if (!verified) {
        throw unauthorized()
    }
    c.set("auth", {
        user: verified.user,
        business,
        role: business ? await roleIn(services, business, verified.user.id) : "customer",
    })
    await next()
})

/** Owner by the shop record, courier by an active courier row, everyone else is a customer. */
async function roleIn(
    services: Services,
    business: Business,
    telegramId: number,
): Promise<ViewerRole> {
    if (business.isOwnedBy(telegramId)) {
        return "owner"
    }
    const courier = await services.couriers.findByTelegramId(business.id, telegramId)
    return courier?.worksFor(business.id) ? "courier" : "customer"
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

export const requireCourier = createMiddleware<AppEnv>(async (c, next) => {
    const business = shopOf(c)
    if (c.get("auth").role !== "courier") {
        throw ForbiddenError.notCourier(business.id)
    }
    await next()
})
