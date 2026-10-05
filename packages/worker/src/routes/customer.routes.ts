import { zValidator } from "@hono/zod-validator"
import { receiptExpired } from "@zumda/core"
import { Hono } from "hono"

import { shopOf } from "../auth.js"
import { readReceipt } from "../http/images.js"
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

    /**
     * «Я перевёл» with the screenshot of the transfer as the body: the owner checks the card and
     * accepts. Without a picture it is refused (RECEIPT_REQUIRED).
     */
    .post("/orders/:id/transfer-sent", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const receipt = await readReceipt(c.req.raw)
        const { order, changed } = await services.useCases.markTransferSent.execute({
            telegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            orderId: c.req.valid("param").id,
            receipt,
        })
        if (changed) {
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).transferSent(shopOf(c), order, receipt),
            )
        }
        return c.json(order)
    })

    /**
     * «Do'konga eslatish»: no answer about the transfer for a while; the owner is asked again with
     * the same «Ha, … keldi» / «Yo'q, kelmadi». At most once per pause (REMIND_TOO_SOON).
     */
    .post("/orders/:id/transfer-reminder", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const order = await services.useCases.remindTransfer.execute({
            telegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            orderId: c.req.valid("param").id,
        })
        inBackground(
            c.executionCtx,
            services,
            new Notifier(services).askPaymentConfirm(shopOf(c), order, true),
        )
        return c.json(order)
    })

    /** The transfer screenshot: only the order's customer and the shop's owner, never cached. */
    .get("/orders/:id/receipt", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const { key, sentAt } = await services.useCases.getTransferReceipt.execute({
            telegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            orderId: c.req.valid("param").id,
        })
        const object = await services.env.RECEIPTS.get(key)
        if (!object) {
            // Kept 30 days (the bucket's lifecycle deletes it): gone for good, not an error.
            return receiptExpired(sentAt, services.clock.now())
                ? c.json(
                      { error: { code: "RECEIPT_EXPIRED", message: "The receipt was deleted" } },
                      410,
                  )
                : c.json({ error: { code: "NOT_FOUND", message: "No receipt" } }, 404)
        }
        return new Response(object.body, {
            headers: {
                "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        })
    })
