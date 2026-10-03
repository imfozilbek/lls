import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { requireCourier } from "../auth.js"
import {
    courierOrderBody,
    courierProfileBody,
    idParam,
    networkMembershipBody,
    onInvalid,
    shiftBody,
} from "../http/schemas.js"
import { notifyNetworkClaim } from "../network-flow.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"

/**
 * "Мои доставки", opened from the Zumda courier bot: the courier's orders across all their
 * shops.
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
        const services = c.get("services")
        const telegramId = c.get("auth").user.id
        const profile = await services.useCases.setShift.execute({
            telegramId,
            onShift: c.req.valid("json").onShift,
        })
        if (profile.onShift && profile.inNetwork) {
            // Network orders already waiting nearby reach the chat too.
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).offerWaitingOrders(telegramId),
            )
        }
        return c.json(profile)
    })

    /** «Беру заказы района»: the courier's own consent to the district network. */
    .put("/network", zValidator("json", networkMembershipBody, onInvalid), async (c) => {
        const services = c.get("services")
        const telegramId = c.get("auth").user.id
        const profile = await services.useCases.setNetworkMembership.execute({
            telegramId,
            inNetwork: c.req.valid("json").inNetwork,
        })
        if (profile.onShift && profile.inNetwork) {
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).offerWaitingOrders(telegramId),
            )
        }
        return c.json(profile)
    })

    .get("/network/orders", async (c) => {
        const orders = await c.get("services").useCases.listNetworkOrders.execute({
            telegramId: c.get("auth").user.id,
        })
        return c.json({
            data: orders,
            meta: { page: 1, limit: orders.length, total: orders.length },
        })
    })

    /** «Беру»: the first network courier gets the order; the others hear it is taken. */
    .post("/network/orders/:id/claim", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const claim = await services.useCases.claimNetworkOrder.execute({
            telegramId: c.get("auth").user.id,
            orderId: c.req.valid("param").id,
        })
        inBackground(c.executionCtx, services, notifyNetworkClaim(services, claim))
        return c.json(claim.order)
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
