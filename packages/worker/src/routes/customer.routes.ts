import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { shopOf } from "../auth.js"
import {
    customerCancelBody,
    idParam,
    meBody,
    pageQuery,
    placeOrderBody,
    productsQuery,
    onInvalid,
} from "../http/schemas.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"

/** What a customer does inside a shop's Mini App. */
export const customerRoutes = new Hono<AppEnv>()
    .get("/shop", async (c) => {
        const { user, isOwner } = c.get("auth")
        const shop = await c
            .get("services")
            .useCases.getShopBySlug.execute(shopOf(c).slug.value, user.id)
        // Lets the app show "Мой магазин" to the owner without exposing the owner's id.
        return c.json({ ...shop, viewerIsOwner: isOwner })
    })

    .get("/shop/products", zValidator("query", productsQuery, onInvalid), async (c) => {
        const query = c.req.valid("query")
        const page = await c.get("services").useCases.listProducts.execute({
            ...query,
            businessId: shopOf(c).id,
            audience: "customer",
            actorTelegramId: c.get("auth").user.id,
        })
        return c.json(page)
    })

    .get("/me", async (c) => {
        const customer = await c
            .get("services")
            .useCases.resolveCustomer.execute(c.get("auth").user)
        return c.json(customer)
    })

    .patch("/me", zValidator("json", meBody, onInvalid), async (c) => {
        const customer = await c.get("services").useCases.updateCustomer.execute({
            user: c.get("auth").user,
            language: c.req.valid("json").language,
        })
        return c.json(customer)
    })

    .post("/orders", zValidator("json", placeOrderBody, onInvalid), async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const order = await services.useCases.placeOrder.execute({
            ...c.req.valid("json"),
            user: c.get("auth").user,
            businessId: business.id,
        })
        inBackground(c.executionCtx, new Notifier(services).orderPlaced(business, order))
        return c.json(order, 201)
    })

    .get("/orders", zValidator("query", pageQuery, onInvalid), async (c) => {
        const page = await c.get("services").useCases.listMyOrders.execute({
            ...c.req.valid("query"),
            telegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json(page)
    })

    .get("/orders/:id", zValidator("param", idParam, onInvalid), async (c) => {
        const order = await c.get("services").useCases.getOrder.execute({
            telegramId: c.get("auth").user.id,
            orderId: c.req.valid("param").id,
        })
        return c.json(order)
    })

    .patch(
        "/orders/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", customerCancelBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const order = await services.useCases.cancelOrder.execute({
                telegramId: c.get("auth").user.id,
                orderId: c.req.valid("param").id,
                reason: c.req.valid("json").reason,
            })
            inBackground(c.executionCtx, new Notifier(services).orderChanged(shopOf(c), order))
            return c.json(order)
        },
    )
