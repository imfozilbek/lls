import { zValidator } from "@hono/zod-validator"
import { languageFromTelegram } from "@lls/core"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { ordersCsv, localDateTime } from "../http/csv.js"
import { ApiError } from "../http/errors.js"
import { looksLike, readImageBody } from "../http/images.js"
import { handoverBody, idParam, moneyQuery, onInvalid, paymentBody } from "../http/schemas.js"
import { Notifier, inBackground } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"

import type { AppEnv } from "../env.js"
import type { Business, Language } from "@lls/core"
import type { Context } from "hono"

const PNG = "image/png"

/** Files go to the owner in the language they chose in the app (Telegram's otherwise). */
async function ownerLanguage(c: Context<AppEnv>, business: Business): Promise<Language> {
    const owner = await c.get("services").customers.findByTelegramId(business.ownerTelegramId.value)
    return owner?.language ?? languageFromTelegram(c.get("auth").user.languageCode)
}

/** «Деньги» in "Мой магазин": the report, payments, couriers' cash, the CSV and the poster. */
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
            shop: business.name,
            from: day(from),
            to: day(lastDay),
        })
        await new Notifier(services).fileToOwner(
            business,
            {
                name: `${business.slug.value}-${day(from)}-${day(lastDay)}.csv`,
                contentType: "text/csv; charset=utf-8",
                bytes: new TextEncoder().encode(ordersCsv(orders, t)),
            },
            caption,
        )
        return c.json({ sent: orders.length })
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
            const body = c.req.valid("json")
            const order =
                body.action === "paid"
                    ? await services.useCases.confirmPayment.execute({
                          ...ids,
                          method: body.method,
                      })
                    : await services.useCases.markRefunded.execute(ids)
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).paymentChanged(business, order),
            )
            return c.json(order)
        },
    )

    /** The owner took cash from a courier. Returns every courier's cash on hand after it. */
    .post(
        "/couriers/:id/handovers",
        zValidator("param", idParam, onInvalid),
        zValidator("json", handoverBody, onInvalid),
        async (c) => {
            const couriers = await c.get("services").useCases.recordHandover.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: shopOf(c).id,
                courierId: c.req.valid("param").id,
                amount: c.req.valid("json").amount,
            })
            return c.json({ data: couriers })
        },
    )

    /** The QR poster drawn in the app comes back as a PNG file in the owner's chat. */
    .post("/shop/poster", async (c) => {
        const business = shopOf(c)
        const body = await readImageBody(c.req.raw)
        if (c.req.header("Content-Type") !== PNG || !looksLike(PNG, body)) {
            throw new ApiError(415, "UNSUPPORTED_IMAGE", "The poster must be a PNG image")
        }
        const t = textsFor(await ownerLanguage(c, business), business.type)
        await new Notifier(c.get("services")).fileToOwner(
            business,
            {
                name: `${business.slug.value}-qr.png`,
                contentType: PNG,
                bytes: new Uint8Array(body),
            },
            fill(t.posterCaption, { shop: business.name }),
        )
        return c.json({ sent: true })
    })
