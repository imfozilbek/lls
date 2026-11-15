import { describe, expect, it } from "vitest"

import { parseStock, stockText, stockUnit } from "./stock-input.js"

describe("the stock as the owner types it", () => {
    it("pieces as whole numbers, kilograms with a comma, kept in grams", () => {
        expect(parseStock("12", "pcs")).toBe(12)
        expect(parseStock(" 1 200 ", "pcs")).toBe(1200)
        expect(parseStock("12,5", "kg")).toBe(12_500)
        expect(parseStock("0", "pcs")).toBe(0)
        expect(stockText(12_500, "kg")).toBe("12,5")
        expect(stockText(40, "pcs")).toBe("40")
        expect(stockText(undefined, "pcs")).toBe("")
    })

    it("never a fraction of a piece, a negative or an empty count", () => {
        expect(parseStock("1,5", "pcs")).toBeNull()
        expect(parseStock("-2", "pcs")).toBeNull()
        expect(parseStock("", "kg")).toBeNull()
        expect(parseStock("ikki", "pcs")).toBeNull()
    })

    it("names the unit the field counts in", () => {
        const units = { kg: "kg", g: "g", pcs: "dona" }
        expect(stockUnit("kg", units)).toBe("kg")
        expect(stockUnit("g100", units)).toBe("g")
        expect(stockUnit("pcs", units)).toBe("dona")
    })
})
