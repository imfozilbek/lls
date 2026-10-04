import { zValidator } from "@hono/zod-validator"
import { languageFromTelegram } from "@zumda/core"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { ordersCsv, localDateTime } from "../http/csv.js"
import { ApiError } from "../http/errors.js"
import { looksLike, readImageBody, storePoster } from "../http/images.js"
import { idParam, moneyQuery, onInvalid, paymentBody } from "../http/schemas.js"
import { networkAfterStep, notifyPaymentConfirmed } from "../network-flow.js"
import { escapeHtml } from "../telegram/gateway.js"
import { Notifier, inBackground } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"

import type { AppEnv } from "../env.js"
import type { Business, Language } from "@zumda/core"
import type { Context } from "hono"

const PNG = "image/png"

/** Files go to the owner in the language they chose in the app (Telegram's otherwise). */
async function ownerLanguage(c: Context<AppEnv>, business: Business): Promise<Language> {
    const owner = await c.get("services").customers.findByTelegramId(business.ownerTelegramId.value)
    return owner?.language ?? languageFromTelegram(c.get("auth").user.languageCode)
}

/** «Деньги» in "Мой магазин": the report, transfers and refunds, the CSV and the poster. */
export const moneyRoutes = new Hono<AppEnv>()
    .use(requireOwner)

    .get("/money", zValidator("query", moneyQuery, onInvalid), async (c) => {
        const report = await c.get("services").useCases.moneyReport.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
            period: c.req.valid("query").period,
        })
        return c.json(report)
    })

    /** The bot sends the period's orders as a CSV file to the owner's chat. */
    .post("/money/export", zValidator("query", moneyQuery, onInvalid), async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const { from, to, orders } = await services.useCases.exportOrders.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            period: c.req.valid("query").period,
        })
        const t = textsFor(await ownerLanguage(c, business), business.type)
        const day = (date: Date): string => localDateTime(date.toISOString()).slice(0, 10)
        const lastDay = new Date(to.getTime() - 1)
        const caption = fill(t.reportCaption, {
            shop: escapeHtml(business.name),
            from: day(from),
            to: day(lastDay),
        })
        const delivered = await new Notifier(services).fileToOwner(
            business,
            {
                name: `${business.slug.value}-${day(from)}-${day(lastDay)}.csv`,
                contentType: "text/csv; charset=utf-8",
                bytes: new TextEncoder().encode(ordersCsv(orders, t)),
            },
            caption,
        )
        return c.json({ sent: orders.length, delivered })
    })

    .patch(
        "/orders/:id/payment",
        zValidator("param", idParam, onInvalid),
        zValidator("json", paymentBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const business = shopOf(c)
            const ids = {
                actorTelegramId: c.get("auth").user.id,
                businessId: business.id,
                orderId: c.req.valid("param").id,
            }
            if (c.req.valid("json").action === "rejected") {
                // «Pul kelmadi»: the customer checks and sends the screenshot again.
                const order = await services.useCases.rejectTransfer.execute(ids)
                inBackground(
                    c.executionCtx,
                    services,
                    new Notifier(services).transferRejected(business, order),
                )
                return c.json(order)
            }
            if (c.req.valid("json").action === "cash_received") {
                return c.json(await services.useCases.receiveCourierCash.execute(ids))
            }
            if (c.req.valid("json").action === "refunded") {
                const order = await services.useCases.markRefunded.execute(ids)
                inBackground(
                    c.executionCtx,
                    services,
                    new Notifier(services).paymentChanged(business, order),
                )
                return c.json(order)
            }
            // «Деньги пришли, принять»: paid and accepted; the network if no courier is free.
            const paid = await services.useCases.confirmPayment.execute(ids)
            const step = await networkAfterStep(services, paid)
            inBackground(
                c.executionCtx,
                services,
                notifyPaymentConfirmed(services, business, step.order, step.request),
            )
            return c.json(step.order)
        },
    )

    /**
     * The QR poster drawn in the app comes back as a PNG file in the owner's chat, and is kept
     * for the app's «Yuklab olish» (`key`, public under /img).
     */
    .post("/shop/poster", async (c) => {
        const business = shopOf(c)
        const body = await readImageBody(c.req.raw)
        if (c.req.header("Content-Type") !== PNG || !looksLike(PNG, body)) {
            throw new ApiError(415, "UNSUPPORTED_IMAGE", "The poster must be a PNG image")
        }
        const key = await storePoster(
            c.env.BUCKET,
            { id: business.id, slug: business.slug.value },
            body,
        )
        const t = textsFor(await ownerLanguage(c, business), business.type)
        const delivered = await new Notifier(c.get("services")).fileToOwner(
            business,
            {
                name: `${business.slug.value}-qr.png`,
                contentType: PNG,
                bytes: new Uint8Array(body),
            },
            fill(t.posterCaption, { shop: escapeHtml(business.name) }),
        )
        return c.json({ delivered, key })
    })
