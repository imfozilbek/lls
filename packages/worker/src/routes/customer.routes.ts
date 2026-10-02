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
        const { user, role } = c.get("auth")
        const shop = await c
            .get("services")
            .useCases.getShopBySlug.execute(shopOf(c).slug.value, user.id)
        // Lets the app show "Мой магазин" or "Мои доставки" without exposing anyone's id.
        return c.json({ ...shop, viewerRole: role })
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
            .useCases.resolveCustomer.execute(c.get("auth").user, c.get("auth").scope)
        return c.json(customer)
    })

    .patch("/me", zValidator("json", meBody, onInvalid), async (c) => {
        const customer = await c.get("services").useCases.updateCustomer.execute({
            user: c.get("auth").user,
            scope: c.get("auth").scope,
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
            // Fixed by the bot that signed the request: own bot = never commissioned.
            channel: c.get("auth").channel,
        })
        const notifier = new Notifier(services)
        inBackground(c.executionCtx, services, notifier.orderPlaced(business, order))
        inBackground(c.executionCtx, services, notifier.askForTransfer(business, order))
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
            businessId: shopOf(c).id,
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
                businessId: shopOf(c).id,
                orderId: c.req.valid("param").id,
                reason: c.req.valid("json").reason,
            })
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).orderChanged(shopOf(c), order),
            )
            return c.json(order)
        },
    )

    /** «Я перевёл»: the customer sent the transfer; the owner checks the card and accepts. */
    .post("/orders/:id/transfer-sent", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const { order, changed } = await services.useCases.markTransferSent.execute({
            telegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            orderId: c.req.valid("param").id,
        })
        if (changed) {
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).transferSent(shopOf(c), order),
            )
        }
        return c.json(order)
    })
