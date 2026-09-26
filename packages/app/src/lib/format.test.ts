import { describe, expect, it } from "vitest"

import { readableInk } from "./brand.js"
import { formatMoney, formatQuantity, formatTime, hexToRgbChannels } from "./format.js"

import type { Language } from "@lls/core"

const UZ = "uz" as Language
const RU = "ru" as Language

describe("formatMoney", () => {
    it("groups thousands with thin no-break spaces and adds the currency", () => {
        expect(formatMoney(78_000, UZ)).toBe("78 000 so'm")
        expect(formatMoney(1_250_000, RU)).toBe("1 250 000 сум")
        expect(formatMoney(500, RU)).toBe("500 сум")
    })
})

describe("formatTime", () => {
    const now = new Date("2026-09-26T10:00:00Z")
    it("shows only the time for today in Tashkent", () => {
        expect(formatTime("2026-09-26T09:05:00Z", RU, now)).toBe("14:05")
    })
    it("shows the date for other days", () => {
        expect(formatTime("2026-09-24T20:30:00Z", UZ, now)).toBe("25 sen, 01:30")
    })
})

describe("colors", () => {
    it("parses hex to rgb channels", () => {
        expect(hexToRgbChannels("#0ea5e9")).toBe("14 165 233")
        expect(hexToRgbChannels("red")).toBeNull()
    })
    it("picks readable text on the brand color", () => {
        expect(readableInk("220 38 38")).toBe("255 255 255")
        expect(readableInk("245 158 11")).toBe("17 24 39")
    })
})

describe("formatQuantity", () => {
    it("shows grams as kilograms with a comma", () => {
        expect(formatQuantity(1500, "kg", "kg")).toBe("1,5 kg")
        expect(formatQuantity(250, "kg", "кг")).toBe("0,25 кг")
    })

    it("shows pieces as they are", () => {
        expect(formatQuantity(3, "pcs", "kg")).toBe("3")
    })
})
