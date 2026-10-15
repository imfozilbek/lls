import { PaymentMethod, PaymentOptions } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { paymentReady, phoneReady, takesOrdersNow } from "./shop-ready.js"

describe("what the owner has set up", () => {
    it("a way of paying: cash, or the card with a card added", () => {
        expect(paymentReady({ paymentOptions: PaymentOptions.CASH, hasPayoutCard: false })).toBe(
            true,
        )
        expect(paymentReady({ paymentOptions: PaymentOptions.BOTH, hasPayoutCard: false })).toBe(
            true,
        )
        expect(paymentReady({ paymentOptions: PaymentOptions.CARD, hasPayoutCard: false })).toBe(
            false,
        )
        expect(paymentReady({ paymentOptions: PaymentOptions.CARD, hasPayoutCard: true })).toBe(
            true,
        )
    })

    it("a number to call: the shop's own, or the owner's standing in", () => {
        expect(phoneReady({})).toBe(false)
        expect(phoneReady({ callPhone: "+998905550001" })).toBe(true)
        expect(phoneReady({ contactPhone: "+998901234501" })).toBe(true)
    })

    it("orders now: open, and a way to pay the storefront offers", () => {
        expect(takesOrdersNow({ isOpen: true, paymentMethods: [] })).toBe(false)
        expect(takesOrdersNow({ isOpen: false, paymentMethods: [PaymentMethod.CASH] })).toBe(false)
        expect(takesOrdersNow({ isOpen: true, paymentMethods: [PaymentMethod.CASH] })).toBe(true)
    })
})
