import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { requireCourier, shopOf } from "../auth.js"
import { courierOrderBody, idParam, onInvalid } from "../http/schemas.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"

/** "Мои доставки": a courier of the shop from `X-Shop`, only their own orders. */
export const courierRoutes = new Hono<AppEnv>()
    .use(requireCourier)

    .get("/orders", async (c) => {
        const orders = await c.get("services").useCases.listCourierOrders.execute({
            telegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json({ data: orders })
    })

    .patch(
        "/orders/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", courierOrderBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const business = shopOf(c)
            const order = await services.useCases.advanceOrder.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: business.id,
                orderId: c.req.valid("param").id,
                to: c.req.valid("json").status,
            })
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).orderChanged(business, order),
            )
            return c.json(order)
        },
    )
