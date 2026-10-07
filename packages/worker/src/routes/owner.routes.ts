import { zValidator } from "@hono/zod-validator"
import { BusinessStatus, EntityNotFoundError, OrderStatus, toShopOwnerDTO } from "@zumda/core"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { ApiError } from "../http/errors.js"
import {
    deleteImage,
    readImageBody,
    readJpeg,
    replaceImage,
    storeImage,
    withStoredImage,
} from "../http/images.js"
import { rateLimit } from "../http/rate-limit.js"
import {
    assignCourierBody,
    courierReviewBody,
    courierSchedulePatch,
    idParam,
    ownerOrderBody,
    ownerOrdersQuery,
    productBody,
    productsBody,
    productPatchBody,
    productsQuery,
    shopPatchBody,
    tripBody,
    tripOrderBody,
    onInvalid,
} from "../http/schemas.js"
import { networkAfterStep, notifyOwnerStep, reportOverdueNetworkOrders } from "../network-flow.js"
import { TelegramApiError } from "../telegram/gateway.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"
import type { Services } from "../services.js"
import type { Context } from "hono"

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
            // Telegram said no (often «Too Many Requests»): the owner tries again; not our outage.
            console.warn("Bot picture refused", error.description)
            throw new ApiError(422, "BOT_PHOTO_FAILED", "Telegram did not accept the bot picture")
        }
        throw error
    }
}

/** "Мой магазин": only the owner of the shop from `X-Shop`. */
/** The trips orders just left (moved to a courier or another trip): their way is planned again. */
function refreshLeftTrips(
    c: Context<AppEnv>,
    left: readonly (string | undefined)[],
    now: string | undefined,
): void {
    const services = c.get("services")
    for (const tripId of new Set(left)) {
        if (tripId && tripId !== now) {
            inBackground(
                c.executionCtx,
                services,
                services.useCases.refreshTripRoute.execute({ tripId }),
            )
        }
    }
}

export const ownerRoutes = new Hono<AppEnv>()
    .use(requireOwner)

    .get("/shop", (c) => c.json(toShopOwnerDTO(shopOf(c), c.get("services").clock.now())))

    /** A rejected application, fixed right here by its owner, goes to the admins again. */
    .post("/shop/resubmit", async (c) => {
        const services = c.get("services")
        const shop = await services.useCases.resubmitShop.execute({
            ownerTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        inBackground(c.executionCtx, services, new Notifier(services).shopRegistered(shop))
        return c.json(shop)
    })

    .patch("/shop", zValidator("json", shopPatchBody, onInvalid), async (c) => {
        const services = c.get("services")
        const patch = c.req.valid("json")
        const shop = await services.useCases.updateShop.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            patch,
        })
        // The bot's description carries the shop's name; the application sets it the first time.
        if (patch.name !== undefined && shop.status !== BusinessStatus.DISABLED) {
            inBackground(c.executionCtx, services, new Notifier(services).shopBotDescriptions(shop))
        }
        return c.json(shop)
    })

    .put("/shop/bot-photo", async (c) => {
        await setShopBotPhoto(c.get("services"), shopOf(c).id, await readJpeg(c.req.raw))
        return c.body(null, 204)
    })

    /** «Botingizni oching»: whether the shop's bot may write to the owner now. */
    .post("/shop/bot-check", async (c) => {
        const ownerChat = await new Notifier(c.get("services")).checkOwnerChat(shopOf(c))
        return c.json({ ownerChat })
    })

    .put("/shop/logo", async (c) => {
        const business = shopOf(c)
        // Read now: the use case below changes this same object.
        const previousKey = business.logoKey
        const services = c.get("services")
        const key = await storeImage(
            c.env.BUCKET,
            `shops/${business.id}/logo`,
            c.req.header("Content-Type"),
            await readImageBody(c.req.raw),
        )
        const shop = await withStoredImage(c.env.BUCKET, key, () =>
            services.useCases.updateShop.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: business.id,
                patch: { logoKey: key },
            }),
        )
        await replaceImage(c.env.BUCKET, previousKey, key)
        return c.json(shop)
    })

    /** What the owner's screen polls: the list is read again only when this changes. */
    .get("/orders/version", async (c) => {
        const version = await c.get("services").useCases.shopOrdersVersion.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json({ version })
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
            // A cancelled stop leaves the trip's way.
            if (order.tripId && order.status === OrderStatus.CANCELLED) {
                const tripId = order.tripId
                inBackground(
                    c.executionCtx,
                    services,
                    services.useCases.refreshTripRoute.execute({ tripId }),
                )
            }
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
            // Given to a courier by itself, the order left its trip: that trip's way changes.
            refreshLeftTrips(c, [previous?.tripId], order.tripId)
            return c.json(order)
        },
    )

    /** «Bir yo'nalish»: several orders one way with one courier, stops in this order. */
    .post("/trips", zValidator("json", tripBody, onInvalid), async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const { courierId, orderIds } = c.req.valid("json")
        const before = await Promise.all(orderIds.map((id) => services.orders.findById(id)))
        const previous = new Map(before.map((o, i) => [orderIds[i] ?? "", o?.courierId]))
        const trip = await services.useCases.createTrip.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            courierId,
            orderIds,
        })
        inBackground(
            c.executionCtx,
            services,
            new Notifier(services).tripAssigned(business, trip, previous),
        )
        refreshLeftTrips(
            c,
            before.map((o) => o?.tripId),
            trip.trip.id,
        )
        return c.json({ trip: trip.trip, orders: trip.orders }, 201)
    })

    /** The shop's trips still on the way (the orders come with `/orders`). */
    .get("/trips", async (c) => {
        const trips = await c.get("services").useCases.listShopTrips.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json({ data: trips, meta: { page: 1, limit: trips.length, total: trips.length } })
    })

    /** The owner moves the stops still to go; the way is planned again. */
    .patch(
        "/trips/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", tripOrderBody, onInvalid),
        async (c) => {
            const trip = await c.get("services").useCases.reorderTrip.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: shopOf(c).id,
                tripId: c.req.valid("param").id,
                orderIds: c.req.valid("json").orderIds,
            })
            return c.json({ trip: trip.trip, orders: trip.orders })
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

    .post(
        "/products/bulk",
        rateLimit("BULK_LIMITER"),
        zValidator("json", productsBody, onInvalid),
        async (c) => {
            const result = await c.get("services").useCases.createProducts.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: shopOf(c).id,
                items: c.req.valid("json").items,
            })
            return c.json(result, 201)
        },
    )

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
        const previousKey = previous.imageKey
        const key = await storeImage(
            c.env.BUCKET,
            `shops/${business.id}/products`,
            c.req.header("Content-Type"),
            await readImageBody(c.req.raw),
        )
        const product = await withStoredImage(c.env.BUCKET, key, () =>
            useCases.updateProduct.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: business.id,
                productId,
                patch: { imageKey: key },
            }),
        )
        await replaceImage(c.env.BUCKET, previousKey, key)
        return c.json(product)
    })

    .delete("/products/:id/image", zValidator("param", idParam, onInvalid), async (c) => {
        const { useCases, products } = c.get("services")
        const productId = c.req.valid("param").id
        const previousKey = (await products.findById(productId))?.imageKey
        const product = await useCases.updateProduct.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            productId,
            patch: { imageKey: null },
        })
        await replaceImage(c.env.BUCKET, previousKey, undefined)
        return c.json(product)
    })
