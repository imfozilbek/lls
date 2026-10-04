import { describe, expect, it } from "vitest"

import { CardSystem, PayoutCard, cardSystemOf } from "../../../domain/value-objects/payout-card.js"

describe("cardSystemOf", () => {
    it.each([
        ["9860 1234", CardSystem.HUMO],
        ["8600 0000 0000 0000", CardSystem.UZCARD],
        ["5614 6812", CardSystem.UZCARD],
        ["2200 1234", CardSystem.MIR],
        ["2204 1234", CardSystem.MIR],
        ["2221 0000", CardSystem.MASTERCARD],
        ["2720 9999", CardSystem.MASTERCARD],
        ["5100", CardSystem.MASTERCARD],
        ["5555 5555", CardSystem.MASTERCARD],
        ["4111-1111", CardSystem.VISA],
        ["6250 9412", CardSystem.UNIONPAY],
    ])("%s is %s", (number, system) => {
        expect(cardSystemOf(number)).toBe(system)
    })

    it("knows nothing outside the ranges, nor from too few digits", () => {
        for (const number of ["2205 0000", "2220 0000", "2721 0000", "1234 5678", "9861", "56"]) {
            expect(cardSystemOf(number)).toBeNull()
        }
        expect(cardSystemOf("")).toBeNull()
        expect(cardSystemOf("98")).toBeNull()
        expect(cardSystemOf("abcd")).toBeNull()
    })

    it("tells the system already while the number is typed", () => {
        expect(cardSystemOf("4")).toBe(CardSystem.VISA)
        expect(cardSystemOf("986")).toBeNull()
        expect(cardSystemOf("9860")).toBe(CardSystem.HUMO)
    })

    it("a card of an unknown system is still accepted, only its system is unknown", () => {
        // secret-scan: fake (passes Luhn, not a real card)
        const card = PayoutCard.create("1234 5678 9012 3452", "Rustam Karimov")
        expect(card.system).toBeNull()
        // secret-scan: fake
        expect(PayoutCard.create("4111 1111 1111 1111", "Rustam").system).toBe(CardSystem.VISA)
    })
})
