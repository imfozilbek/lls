import { describe, expect, it } from "vitest"

import { readableInk, readableText } from "./brand.js"
import { formatMoney, formatQuantity, formatTime, hexToRgbChannels } from "./format.js"

import type { Language } from "@zumda/core"

const UZ = "uz" as Language

describe("formatMoney", () => {
    it("groups thousands with thin no-break spaces and adds the currency", () => {
        expect(formatMoney(78_000, UZ)).toBe("78 000 so'm")
        expect(formatMoney(1_250_000, UZ)).toBe("1 250 000 so'm")
        expect(formatMoney(500, UZ)).toBe("500 so'm")
    })
})

describe("formatTime", () => {
    const now = new Date("2026-09-26T10:00:00Z")
    it("shows only the time for today in Tashkent", () => {
        expect(formatTime("2026-09-26T09:05:00Z", UZ, now)).toBe("14:05")
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
        // A mid-tone blue: neither white nor gray-ink reaches AA, black does.
        expect(readableInk("2 132 199")).toBe("0 0 0")
    })

    it("brand words darken only as much as they must to read on gray", () => {
        const luminance = (channels: string): number => {
            const [r, g, b] = channels.split(" ").map((c) => {
                const v = Number(c) / 255
                return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
        }
        const onGray = (channels: string): number =>
            (luminance("243 244 246") + 0.05) / (luminance(channels) + 0.05)
        for (const amber of ["245 158 11", "217 119 6", "14 165 233", "21 128 61"]) {
            expect(onGray(readableText(amber))).toBeGreaterThanOrEqual(4.5)
        }
        // Already dark enough: kept as it is.
        expect(readableText("17 24 39")).toBe("17 24 39")
    })
})

describe("formatQuantity", () => {
    const units = { kg: "kg", g: "g", m2: "m²", hour: "soat", pack: "qadoq" }

    it("shows grams of a kilogram item as kilograms with a comma", () => {
        expect(formatQuantity(1500, "kg", units)).toBe("1,5 kg")
        expect(formatQuantity(250, "kg", units)).toBe("0,25 kg")
    })

    it("shows goods by 100 g or by the gram in grams, from a kilogram in kilograms", () => {
        expect(formatQuantity(300, "g100", units)).toBe("300 g")
        expect(formatQuantity(1200, "g100", units)).toBe("1,2 kg")
        expect(formatQuantity(2, "g", units)).toBe("2 g")
    })

    it("counts pieces, portions and bottles; names measures and time", () => {
        expect(formatQuantity(3, "pcs", units)).toBe("3")
        expect(formatQuantity(2, "bottle_20l", units)).toBe("2")
        expect(formatQuantity(12, "m2", units)).toBe("12 m²")
        expect(formatQuantity(2, "hour", units)).toBe("2 soat")
        expect(formatQuantity(4, "pack", units)).toBe("4 qadoq")
    })
})
