import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { requireCourier } from "../auth.js"
import {
    courierOrderBody,
    courierProfileBody,
    idParam,
    onInvalid,
    shiftBody,
} from "../http/schemas.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"

/**
 * "Мои доставки", opened from the LLS courier bot: the courier's orders across all their shops.
 * Who they deliver for is checked by their approved links, order by order.
 */
export const courierRoutes = new Hono<AppEnv>()
    .use(requireCourier)

    .get("/home", async (c) => {
        const home = await c.get("services").useCases.courierHome.execute({
            telegramId: c.get("auth").user.id,
        })
        return c.json(home)
    })

    /** "Я на смене" for today, or the end of the shift. */
    .put("/shift", zValidator("json", shiftBody, onInvalid), async (c) => {
        const profile = await c.get("services").useCases.setShift.execute({
            telegramId: c.get("auth").user.id,
            onShift: c.req.valid("json").onShift,
        })
        return c.json(profile)
    })

    .patch("/profile", zValidator("json", courierProfileBody, onInvalid), async (c) => {
        const profile = await c.get("services").useCases.updateCourierProfile.execute({
            telegramId: c.get("auth").user.id,
            vehicle: c.req.valid("json").vehicle || null,
        })
        return c.json(profile)
    })

    .patch(
        "/orders/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", courierOrderBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const order = await services.useCases.courierAdvanceOrder.execute({
                telegramId: c.get("auth").user.id,
                orderId: c.req.valid("param").id,
                to: c.req.valid("json").status,
                paidWith: c.req.valid("json").paidWith,
            })
            const business = await services.businesses.findById(order.businessId)
            if (business) {
                inBackground(
                    c.executionCtx,
                    services,
                    new Notifier(services).orderChanged(business, order),
                )
            }
            return c.json(order)
        },
    )
