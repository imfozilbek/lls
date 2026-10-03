import { zValidator } from "@hono/zod-validator"
import { BusinessStatus, EntityNotFoundError, OrderStatus, toShopOwnerDTO } from "@zumda/core"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { ApiError } from "../http/errors.js"
import { deleteImage, readImageBody, readJpeg, storeImage } from "../http/images.js"
import {
    assignCourierBody,
    courierReviewBody,
    courierSchedulePatch,
    idParam,
    ownerOrderBody,
    ownerOrdersQuery,
    productBody,
    productPatchBody,
    productsQuery,
    shopPatchBody,
    onInvalid,
} from "../http/schemas.js"
import { networkAfterStep, notifyOwnerStep, reportOverdueNetworkOrders } from "../network-flow.js"
import { TelegramApiError } from "../telegram/gateway.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"
import type { Services } from "../services.js"

/** Sets the picture the app drew; Telegram's refusal is a 502 the app can name. */
export async function setShopBotPhoto(
    services: Services,
    shopId: string,
    jpeg: Uint8Array,
): Promise<void> {
    try {
        await new Notifier(services).shopBotPhoto(shopId, jpeg)
    } catch (error) {
        if (error instanceof TelegramApiError) {
            throw new ApiError(502, "BOT_PHOTO_FAILED", "Telegram did not accept the bot picture")
        }
        throw error
    }
}

/** "Мой магазин": only the owner of the shop from `X-Shop`. */
export const ownerRoutes = new Hono<AppEnv>()
    .use(requireOwner)

    .get("/shop", (c) => c.json(toShopOwnerDTO(shopOf(c), c.get("services").clock.now())))

    .patch("/shop", zValidator("json", shopPatchBody, onInvalid), async (c) => {
        const services = c.get("services")
        const patch = c.req.valid("json")
        const shop = await services.useCases.updateShop.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            patch,
        })
        // The bot's description carries the shop's name; approval sets it the first time.
        if (patch.name !== undefined && shop.status === BusinessStatus.ACTIVE) {
            inBackground(c.executionCtx, services, new Notifier(services).shopBotDescriptions(shop))
        }
        return c.json(shop)
    })

    .put("/shop/bot-photo", async (c) => {
        await setShopBotPhoto(c.get("services"), shopOf(c).id, await readJpeg(c.req.raw))
        return c.body(null, 204)
    })

    .put("/shop/logo", async (c) => {
        const business = shopOf(c)
        const services = c.get("services")
        const key = await storeImage(
            c.env.BUCKET,
            `shops/${business.id}/logo`,
            c.req.header("Content-Type"),
            await readImageBody(c.req.raw),
        )
        const shop = await services.useCases.updateShop.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            patch: { logoKey: key },
        })
        await deleteImage(c.env.BUCKET, business.logoKey)
        return c.json(shop)
    })

    .get("/orders", zValidator("query", ownerOrdersQuery, onInvalid), async (c) => {
        const page = await c.get("services").useCases.listShopOrders.execute({
            ...c.req.valid("query"),
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json(page)
    })

    .patch(
        "/orders/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", ownerOrderBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const actor = c.get("auth").user.id
            const businessId = shopOf(c).id
            const orderId = c.req.valid("param").id
            const { status, reason } = c.req.valid("json")
            const order =
                status === OrderStatus.CANCELLED
                    ? await services.useCases.cancelOrder.execute({
                          telegramId: actor,
                          businessId,
                          orderId,
                          reason,
                      })
                    : await services.useCases.advanceOrder.execute({
                          actorTelegramId: actor,
                          businessId,
                          orderId,
                          to: status,
                      })
            const step = await networkAfterStep(services, order)
            inBackground(
                c.executionCtx,
                services,
                notifyOwnerStep(services, shopOf(c), step.order, step.request),
            )
            return c.json(step.order)
        },
    )

    /** «Отдать сети района»: the owner hands the order to the district network by hand. */
    .put("/orders/:id/network", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const request = await services.useCases.requestNetworkCourier.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            orderId: c.req.valid("param").id,
        })
        const notifier = new Notifier(services)
        inBackground(
            c.executionCtx,
            services,
            notifier
                .ownerCardChanged(business, request.order)
                .then(() => notifier.networkRequested(request))
                .then(() => reportOverdueNetworkOrders(services)),
        )
        return c.json(request.order)
    })

    .put(
        "/orders/:id/courier",
        zValidator("param", idParam, onInvalid),
        zValidator("json", assignCourierBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const business = shopOf(c)
            const orderId = c.req.valid("param").id
            const previous = await services.orders.findById(orderId)
            const order = await services.useCases.assignCourier.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: business.id,
                orderId,
                courierId: c.req.valid("json").courierId,
            })
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).courierAssigned(business, order, previous?.courierId),
            )
            return c.json(order)
        },
    )

    .get("/couriers", async (c) => {
        const couriers = await c.get("services").useCases.listCouriers.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json(couriers)
    })

    /** A one-time link to the Zumda courier bot: `t.me/<courier_bot>?start=c_<code>`. */
    .post("/couriers/invites", async (c) => {
        const services = c.get("services")
        const invite = await services.useCases.createCourierInvite.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        const bot = await services.telegram.getMe(services.env.COURIER_BOT_TOKEN)
        const link = `https://t.me/${bot.username}?start=c_${invite.code}`
        return c.json({ link, expiresAt: invite.expiresAt }, 201)
    })

    /** The owner's week for a courier, and "сегодня не работает". */
    .patch(
        "/couriers/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", courierSchedulePatch, onInvalid),
        async (c) => {
            const courier = await c.get("services").useCases.setCourierSchedule.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: shopOf(c).id,
                courierId: c.req.valid("param").id,
                ...c.req.valid("json"),
            })
            return c.json(courier)
        },
    )

    /** Approve or decline someone who accepted the invite; the courier hears it in their bot. */
    .post(
        "/couriers/:id/review",
        zValidator("param", idParam, onInvalid),
        zValidator("json", courierReviewBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const business = shopOf(c)
            const change = await services.useCases.reviewCourier.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: business.id,
                courierId: c.req.valid("param").id,
                approve: c.req.valid("json").approve,
            })
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).courierReviewed(business, change.courier, change.telegramId),
            )
            return c.json(change.courier)
        },
    )

    .delete("/couriers/:id", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const removed = await services.useCases.deactivateCourier.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            courierId: c.req.valid("param").id,
        })
        inBackground(
            c.executionCtx,
            services,
            new Notifier(services).courierRemovedFromShop(business, removed.telegramId),
        )
        return c.body(null, 204)
    })

    .get("/products", zValidator("query", productsQuery, onInvalid), async (c) => {
        const page = await c.get("services").useCases.listProducts.execute({
            ...c.req.valid("query"),
            businessId: shopOf(c).id,
            audience: "owner",
            actorTelegramId: c.get("auth").user.id,
        })
        return c.json(page)
    })

    .post("/products", zValidator("json", productBody, onInvalid), async (c) => {
        const product = await c.get("services").useCases.createProduct.execute({
            ...c.req.valid("json"),
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json(product, 201)
    })

    .patch(
        "/products/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", productPatchBody, onInvalid),
        async (c) => {
            const product = await c.get("services").useCases.updateProduct.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: shopOf(c).id,
                productId: c.req.valid("param").id,
                patch: c.req.valid("json"),
            })
            return c.json(product)
        },
    )

    .delete("/products/:id", zValidator("param", idParam, onInvalid), async (c) => {
        const deleted = await c.get("services").useCases.deleteProduct.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            productId: c.req.valid("param").id,
        })
        await deleteImage(c.env.BUCKET, deleted.imageKey)
        return c.body(null, 204)
    })

    .put("/products/:id/image", zValidator("param", idParam, onInvalid), async (c) => {
        const business = shopOf(c)
        const { useCases, products } = c.get("services")
        const productId = c.req.valid("param").id
        const previous = await products.findById(productId)
        if (!previous?.belongsTo(business.id)) {
            throw EntityNotFoundError.product(productId)
        }
        const key = await storeImage(
            c.env.BUCKET,
            `shops/${business.id}/products`,
            c.req.header("Content-Type"),
            await readImageBody(c.req.raw),
        )
        const product = await useCases.updateProduct.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            productId,
            patch: { imageKey: key },
        })
        await deleteImage(c.env.BUCKET, previous?.imageKey)
        return c.json(product)
    })

    .delete("/products/:id/image", zValidator("param", idParam, onInvalid), async (c) => {
        const { useCases, products } = c.get("services")
        const productId = c.req.valid("param").id
        const previous = await products.findById(productId)
        const product = await useCases.updateProduct.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            productId,
            patch: { imageKey: null },
        })
        await deleteImage(c.env.BUCKET, previous?.imageKey)
        return c.json(product)
    })
