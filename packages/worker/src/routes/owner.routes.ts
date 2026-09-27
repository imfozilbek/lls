import { zValidator } from "@hono/zod-validator"
import { EntityNotFoundError, OrderStatus, toShopOwnerDTO } from "@lls/core"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { deleteImage, readImageBody, storeImage } from "../http/images.js"
import {
    assignCourierBody,
    idParam,
    ownerOrderBody,
    ownerOrdersQuery,
    productBody,
    productPatchBody,
    productsQuery,
    shopPatchBody,
    onInvalid,
} from "../http/schemas.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"

/** "Мой магазин": only the owner of the shop from `X-Shop`. */
export const ownerRoutes = new Hono<AppEnv>()
    .use(requireOwner)

    .get("/shop", (c) => c.json(toShopOwnerDTO(shopOf(c), c.get("services").clock.now())))

    .patch("/shop", zValidator("json", shopPatchBody, onInvalid), async (c) => {
        const shop = await c.get("services").useCases.updateShop.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            patch: c.req.valid("json"),
        })
        return c.json(shop)
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

    .get("/stats", async (c) => {
        const stats = await c.get("services").useCases.shopStats.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json(stats)
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
            inBackground(c.executionCtx, new Notifier(services).orderChanged(shopOf(c), order))
            return c.json(order)
        },
    )

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

    /** A one-time link for the shop bot: `t.me/<bot>?start=c_<code>`. */
    .post("/couriers/invites", async (c) => {
        const business = shopOf(c)
        const invite = await c.get("services").useCases.createCourierInvite.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
        })
        const link = `https://t.me/${business.bot.username}?start=c_${invite.code}`
        return c.json({ link, expiresAt: invite.expiresAt }, 201)
    })

    .delete("/couriers/:id", zValidator("param", idParam, onInvalid), async (c) => {
        await c.get("services").useCases.deactivateCourier.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            courierId: c.req.valid("param").id,
        })
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
