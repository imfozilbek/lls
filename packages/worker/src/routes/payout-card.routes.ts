import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { idParam, onInvalid, payoutCardBody } from "../http/schemas.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"
import type { Context } from "hono"

function owner(c: Context<AppEnv>): { actorTelegramId: number; businessId: string } {
    return { actorTelegramId: c.get("auth").user.id, businessId: shopOf(c).id }
}

function cardNotice(
    c: Context<AppEnv>,
    change: { kind: "added" | "payment"; number: string },
): Promise<void> {
    return new Notifier(c.get("services")).cardChanged(shopOf(c), change)
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
        const services = c.get("services")
        const body = c.req.valid("json")
        const cards = await services.useCases.addPayoutCard.execute({ ...owner(c), ...body })
        const added = cards.cards.at(-1)
        if (added) {
            const notice = { kind: "added" as const, number: added.number }
            inBackground(c.executionCtx, services, cardNotice(c, notice))
        }
        return c.json(cards, 201)
    })

    /** Customers are shown this card from the next order on. */
    .put("/shop/cards/:id/payment", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const cardId = c.req.valid("param").id
        const cards = await services.useCases.choosePaymentCard.execute({ ...owner(c), cardId })
        const chosen = cards.cards.find((card) => card.id === cardId)
        if (chosen) {
            const notice = { kind: "payment" as const, number: chosen.number }
            inBackground(c.executionCtx, services, cardNotice(c, notice))
        }
        return c.json(cards)
    })

    .delete("/shop/cards/:id", zValidator("param", idParam, onInvalid), async (c) => {
        await c.get("services").useCases.removePayoutCard.execute({
            ...owner(c),
            cardId: c.req.valid("param").id,
        })
        return c.body(null, 204)
    })
