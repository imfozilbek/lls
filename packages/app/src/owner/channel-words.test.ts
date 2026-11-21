import { Language, SourceLinkKind, Unit } from "@zumda/core"
import { beforeAll, describe, expect, it } from "vitest"

import { dictionaryFor, registerStaff } from "../i18n/index.js"
import { staffUz } from "../i18n/staff.js"
import { formatMoney } from "../lib/format.js"

import { linkCountsText, postPreview } from "./channel-words.js"

import type { ProductDTO, SourceLinkDTO } from "@zumda/core"

const money = (amount: number): string => formatMoney(amount, Language.UZ)

function link(counts: Partial<SourceLinkDTO>): SourceLinkDTO {
    return {
        id: "l",
        kind: SourceLinkKind.AD,
        opens: 0,
        orders: 0,
        sales: 0,
        revenue: 0,
        createdAt: "2026-11-21T00:00:00.000Z",
        ...counts,
    }
}

function product(fields: Partial<ProductDTO>): ProductDTO {
    return {
        id: "p",
        name: "Magnit konstruktor",
        price: 110_000,
        unit: "pcs",
        ...fields,
    } as ProductDTO
}

describe("the channel's words", () => {
    beforeAll(() => registerStaff({ uz: staffUz }))

    it("what a link brought: people, orders, and the delivered ones with their goods", () => {
        const c = dictionaryFor(Language.UZ).owner.channel
        expect(linkCountsText(c, link({}), Language.UZ)).toBe("Hali hech kim kirmadi")
        expect(linkCountsText(c, link({ opens: 12 }), Language.UZ)).toBe(
            "12 kishi kirdi · 0 ta buyurtma",
        )
        const sold = link({ opens: 12, orders: 2, sales: 1, revenue: 110_000 })
        expect(linkCountsText(c, sold, Language.UZ)).toBe(
            `12 kishi kirdi · 2 ta buyurtma · 1 ta yetkazildi: ${money(110_000)}`,
        )
    })

    it("the post's price and age, as the shop's bot writes them under the owner's words", () => {
        const t = dictionaryFor(Language.UZ)
        expect(postPreview(product({ ageFrom: 3 }), t, Language.UZ)).toEqual({
            name: "Magnit konstruktor",
            price: `💰 ${money(110_000)} / dona`,
            age: "👶 3 yoshdan",
        })
        // A portion says no unit; variants say the cheapest one «dan».
        expect(postPreview(product({ unit: Unit.PORTION }), t, Language.UZ).price).toBe(
            `💰 ${money(110_000)}`,
        )
        const latte = product({
            price: 18_000,
            options: { variants: [{ id: "v", name: "0,3 l", price: 18_000 }], addons: [] },
        } as Partial<ProductDTO>)
        expect(postPreview(latte, t, Language.UZ).price).toBe(`💰 ${money(18_000)} dan`)
        expect(postPreview(product({ unit: Unit.G100, price: 9_000 }), t, Language.UZ).price).toBe(
            `💰 ${money(9_000)} / 100 g`,
        )
    })
})
