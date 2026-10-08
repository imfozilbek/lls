/**
 * «Platforma»: what platform admins did with bot commands, now in Zumda | Business (Mini App or
 * business.zumda.shop). Only a person in `PLATFORM_ADMIN_IDS`; the use cases check it again.
 */
import { zValidator } from "@hono/zod-validator"
import { PLATFORM_SHOPS_LIMIT, toShopOwnerDTO } from "@zumda/core"
import { Hono } from "hono"

import { platformAdminIds } from "../env.js"
import { ApiError } from "../http/errors.js"
import { storeImage, withStoredImage } from "../http/images.js"
import {
    adminShopsQuery,
    demoBody,
    districtBody,
    guideParam,
    idParam,
    marketplaceBody,
    onInvalid,
    reviewShopBody,
} from "../http/schemas.js"
import { reportOverdueNetworkOrders } from "../network-flow.js"
import { Notifier, inBackground } from "../telegram/notifier.js"
import { connectReviewedShop } from "../telegram/shop-connection.js"

import type { AppEnv, Bindings } from "../env.js"
import type { Services } from "../services.js"
import type { DemoTemplateKey, ShopOwnerDTO } from "@zumda/core"

const BPS_PER_PERCENT = 100
const METERS_PER_KM = 1000

/** The admin acts on a shop, never on its card. */
function withoutCard(shop: ShopOwnerDTO): Omit<ShopOwnerDTO, "payoutCard"> {
    const { payoutCard: _card, ...rest } = shop
    return rest
}

async function requireShop(services: Services, id: string): Promise<ShopOwnerDTO> {
    const business = await services.businesses.findById(id)
    if (!business) {
        throw new ApiError(404, "NOT_FOUND", "Shop not found")
    }
    return toShopOwnerDTO(business, services.clock.now())
}

/**
 * The sample's logo, from the Mini App's own files (`/demo/<template>.png`), stored as the shop's.
 * Nothing when it cannot be had: a demo works without a logo, it shows the shop's letter.
 */
async function sampleLogo(
    env: Bindings,
    template: DemoTemplateKey,
    businessId: string,
): Promise<string | undefined> {
    try {
        const response = await fetch(`${env.APP_ORIGIN}/demo/${template}.png`)
        if (!response.ok) {
            return undefined
        }
        const body = await response.arrayBuffer()
        return await storeImage(env.BUCKET, `shops/${businessId}/logo`, "image/png", body)
    } catch (error) {
        console.warn(JSON.stringify({ event: "demo_logo_failed", template, error: String(error) }))
        return undefined
    }
}

export function isPlatformAdmin(services: Services, telegramId: number): boolean {
    return platformAdminIds(services.env).includes(telegramId)
}

export const adminRoutes = new Hono<AppEnv>()
    .use(async (c, next) => {
        const { business, role, user } = c.get("auth")
        if (business || role !== "business" || !isPlatformAdmin(c.get("services"), user.id)) {
            throw new ApiError(403, "ADMIN_ONLY", "Only a platform admin can open this")
        }
        await next()
    })

    /** «Arizalar» (pending), «Bizneslar» (active), turned-off shops (disabled). */
    .get("/shops", zValidator("query", adminShopsQuery, onInvalid), async (c) => {
        const { status } = c.req.valid("query")
        const data = await c.get("services").useCases.listPlatformShops.execute({
            actorTelegramId: c.get("auth").user.id,
            status,
        })
        return c.json({ data, meta: { page: 1, limit: PLATFORM_SHOPS_LIMIT, total: data.length } })
    })

    /**
     * «Tasdiqlash» / «Rad etish» (and «O'chirish», «Qayta yoqish» for a live or turned-off shop).
     * Approving connects the shop bot; Telegram refusing is in `bot`, the shop stays approved.
     */
    .patch(
        "/shops/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", reviewShopBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const shop = await services.useCases.reviewShop.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: c.req.valid("param").id,
                ...c.req.valid("json"),
            })
            const bot = await connectReviewedShop(services, shop, new URL(c.req.url).origin)
            return c.json({ shop: withoutCard(shop), bot: shop.status === "active" ? bot : null })
        },
    )

    /** «Botni qayta ulash»: webhook and menu button again (and a fresh managed-bot token). */
    .post("/shops/:id/reconnect", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const shop = await requireShop(services, c.req.valid("param").id)
        if (shop.status !== "active") {
            throw new ApiError(422, "SHOP_NOT_ACTIVE", "Approve the shop first")
        }
        const bot = await connectReviewedShop(services, shop, new URL(c.req.url).origin)
        return c.json({ shop: withoutCard(shop), bot })
    })

    /** The showcase deal: a commission in percent, or `null` to take the shop out. */
    .put(
        "/shops/:id/marketplace",
        zValidator("param", idParam, onInvalid),
        zValidator("json", marketplaceBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const { percent } = c.req.valid("json")
            const current = await requireShop(services, c.req.valid("param").id)
            const shop = await services.useCases.setMarketplaceTerms.execute({
                actorTelegramId: c.get("auth").user.id,
                slug: current.slug,
                commissionBps: percent === null ? null : Math.round(percent * BPS_PER_PERCENT),
            })
            inBackground(c.executionCtx, services, new Notifier(services).showcaseChanged(shop))
            return c.json({ shop: withoutCard(shop) })
        },
    )

    /**
     * «Namuna qilish»: a live shop becomes a demo, filled from the sample (catalog, test card,
     * hours, the owner as courier; the sample's logo if the shop has none).
     */
    .put(
        "/shops/:id/demo",
        zValidator("param", idParam, onInvalid),
        zValidator("json", demoBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const { template } = c.req.valid("json")
            const current = await requireShop(services, c.req.valid("param").id)
            const logoKey = current.logoKey
                ? undefined
                : await sampleLogo(c.env, template, current.id)
            const make = (): Promise<ShopOwnerDTO> =>
                services.useCases.makeDemoShop.execute({
                    actorTelegramId: c.get("auth").user.id,
                    businessId: current.id,
                    template,
                    logoKey,
                })
            const shop = logoKey ? await withStoredImage(c.env.BUCKET, logoKey, make) : await make()
            return c.json({ shop: withoutCard(shop) })
        },
    )

    /** «Namunani tozalash»: the demo's orders are gone, its sample is back. */
    .post("/shops/:id/demo/reset", zValidator("param", idParam, onInvalid), async (c) => {
        const shop = await c.get("services").useCases.resetDemoShop.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: c.req.valid("param").id,
        })
        return c.json({ shop: withoutCard(shop) })
    })

    /** «Qo'llanma»: each audience, everyone it reaches and who has not had the guide yet. */
    .get("/guides", async (c) => {
        const data = await c.get("services").useCases.guideStatus.execute({
            actorTelegramId: c.get("auth").user.id,
        })
        return c.json({ data, meta: { page: 1, limit: data.length, total: data.length } })
    })

    /** One batch of an audience's guide; the app presses again while some are left. */
    .post("/guides/:audience/send", zValidator("param", guideParam, onInvalid), async (c) => {
        const result = await c.get("services").useCases.sendGuides.execute({
            actorTelegramId: c.get("auth").user.id,
            audience: c.req.valid("param").audience,
        })
        return c.json(result)
    })

    /** «Tumanlar»: each district now and over the last week; late network orders are reported. */
    .get("/districts", async (c) => {
        const services = c.get("services")
        const data = await services.useCases.networkStats.execute({
            actorTelegramId: c.get("auth").user.id,
        })
        inBackground(c.executionCtx, services, reportOverdueNetworkOrders(services))
        return c.json({ data, meta: { page: 1, limit: data.length, total: data.length } })
    })

    /** Creates or changes a district; every shop's district is recomputed. */
    .put("/districts", zValidator("json", districtBody, onInvalid), async (c) => {
        const services = c.get("services")
        const { district, shops } = await services.useCases.setDistrict.execute({
            actorTelegramId: c.get("auth").user.id,
            ...c.req.valid("json"),
        })
        return c.json({
            id: district.id,
            name: district.name,
            radiusKm: district.radiusMeters / METERS_PER_KM,
            waitMinutes: district.waitMinutes,
            shops,
        })
    })
