import { describe, expect, it } from "vitest"

import { ownerStep } from "./order-step.js"

import type { OrderDTO } from "@zumda/core"

/** Plain strings, as the server sends them. */
function order(fields: Record<string, unknown>): OrderDTO {
    return {
        status: "preparing",
        nextStatus: "ready",
        payment: { method: "card_transfer", status: "paid" },
        dispatcher: false,
        needsCourierChoice: false,
        ...fields,
    } as unknown as OrderDTO
}

describe("the owner's main button", () => {
    it("a transfer waits for the money; a cash order is accepted at once", () => {
        const pending = { status: "pending", nextStatus: "accepted" }
        const unpaid = { method: "card_transfer", status: "unpaid" }
        expect(ownerStep(order({ ...pending, payment: unpaid }))).toEqual({ kind: "money" })
        const cash = { method: "cash", status: "unpaid" }
        expect(ownerStep(order({ ...pending, payment: cash }))).toEqual({
            kind: "step",
            to: "accepted",
        })
    })

    it("nobody on it: who takes it comes before «Tayyor», with or without couriers", () => {
        const open = order({ needsCourierChoice: true })
        expect(ownerStep(open)).toEqual({ kind: "choose" })
        const ready = order({ status: "ready", nextStatus: "picked_up", needsCourierChoice: true })
        expect(ownerStep(ready)).toEqual({ kind: "choose" })
        // Someone is on it: the owner packs.
        expect(ownerStep(order({}))).toEqual({ kind: "step", to: "ready" })
    })

    it("the dispatcher's steps are not the owner's", () => {
        const ready = order({ status: "ready", nextStatus: "picked_up", dispatcher: true })
        expect(ownerStep(ready)).toEqual({ kind: "dispatcher", to: "picked_up" })
        const sent = order({ status: "picked_up", nextStatus: "delivered", dispatcher: true })
        expect(ownerStep(sent)).toEqual({ kind: "dispatcher", to: "delivered" })
        // Packing is still the owner's.
        expect(ownerStep(order({ dispatcher: true }))).toEqual({ kind: "step", to: "ready" })
    })

    it("a finished order has no button", () => {
        expect(ownerStep(order({ status: "delivered", nextStatus: null }))).toBeNull()
    })
})
