import { zValidator } from "@hono/zod-validator"
import { EntityNotFoundError, OrderStatus, toShopOwnerDTO } from "@lls/core"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { deleteImage, storeImage } from "../http/images.js"
import {
    idParam,
    ownerOrderBody,
    ownerOrdersQuery,
    productBody,
    productPatchBody,
    productsQuery,
    shopPatchBody,
    onInvalid,
} from "../http/schemas.js"

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
            await c.req.arrayBuffer(),
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
            const { useCases } = c.get("services")
            const actor = c.get("auth").user.id
            const orderId = c.req.valid("param").id
            const { status, reason } = c.req.valid("json")
            const order =
                status === OrderStatus.CANCELLED
                    ? await useCases.cancelOrder.execute({ telegramId: actor, orderId, reason })
                    : await useCases.advanceOrder.execute({
                          actorTelegramId: actor,
                          orderId,
                          to: status,
                      })
            return c.json(order)
        },
    )

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
            await c.req.arrayBuffer(),
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
