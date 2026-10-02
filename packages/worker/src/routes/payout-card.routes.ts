import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { idParam, onInvalid, payoutCardBody } from "../http/schemas.js"

import type { AppEnv } from "../env.js"
import type { Context } from "hono"

function owner(c: Context<AppEnv>): { actorTelegramId: number; businessId: string } {
    return { actorTelegramId: c.get("auth").user.id, businessId: shopOf(c).id }
}

/**
 * «Kartalar» in "Мой магазин": the shop keeps many cards and chooses which one customers are
 * shown (the payment card). Customers' orders keep the card they were shown.
 */
export const payoutCardRoutes = new Hono<AppEnv>()
    .use(requireOwner)

    .get("/shop/cards", async (c) =>
        c.json(await c.get("services").useCases.listPayoutCards.execute(owner(c))),
    )

    .post("/shop/cards", zValidator("json", payoutCardBody, onInvalid), async (c) => {
        const cards = await c.get("services").useCases.addPayoutCard.execute({
            ...owner(c),
            ...c.req.valid("json"),
        })
        return c.json(cards, 201)
    })

    /** Customers are shown this card from the next order on. */
    .put("/shop/cards/:id/payment", zValidator("param", idParam, onInvalid), async (c) => {
        const cards = await c.get("services").useCases.choosePaymentCard.execute({
            ...owner(c),
            cardId: c.req.valid("param").id,
        })
        return c.json(cards)
    })

    .delete("/shop/cards/:id", zValidator("param", idParam, onInvalid), async (c) => {
        await c.get("services").useCases.removePayoutCard.execute({
            ...owner(c),
            cardId: c.req.valid("param").id,
        })
        return c.body(null, 204)
    })
