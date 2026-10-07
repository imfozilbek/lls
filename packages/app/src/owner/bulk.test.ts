import { BusinessType, Unit } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { parseList, readyRows } from "./bulk.js"

import type { Template } from "./catalog.js"

const CATALOG: Record<string, Template> = {
    "qora murch": {
        name: "Qora murch",
        category: "spices",
        unit: Unit.G100,
        step: 100,
        variants: [],
        addons: [],
    },
    "lag'mon": { name: "Lag'mon", category: "dough", unit: Unit.PORTION, variants: [], addons: [] },
}
const find = (name: string): Template | undefined => CATALOG[name.toLowerCase()]

describe("«Ro'yxat bilan qo'shish»", () => {
    it("reads name, price and an optional unit; the catalog fills the rest", () => {
        const rows = parseList(
            "Lag'mon 38000\nKompot 15 000 litr\nPomidor 12.000 kg\nQora murch 6000\n\nGilam yuvish 12000 m2",
            BusinessType.FOOD,
            find,
        )
        expect(rows.map((r) => [r.name, r.price, r.unit, r.category, r.error])).toEqual([
            ["Lag'mon", 38_000, Unit.PORTION, "dough", undefined],
            ["Kompot", 15_000, Unit.LITER, "juices", undefined],
            ["Pomidor", 12_000, Unit.KG, "produce", undefined],
            ["Qora murch", 6_000, Unit.G100, "spices", undefined],
            ["Gilam yuvish", 12_000, Unit.SQUARE_METRE, "carpet", undefined],
        ])
        expect(rows[2]?.step).toBe(500)
        expect(rows[3]?.step).toBe(100)
    })

    it("marks a line without a price, a wrong price and a twin; only good rows go", () => {
        const rows = parseList("Choy\nNon 0\nSomsa 8000\nsomsa 9000", BusinessType.FOOD, find)
        expect(rows.map((r) => r.error)).toEqual(["noPrice", "badPrice", undefined, "twin"])
        expect(readyRows(rows).map((r) => r.name)).toEqual(["Somsa"])
    })

    it("sends at most 50 rows at once", () => {
        const text = Array.from({ length: 60 }, (_, i) => `Taom ${i} 1000`).join("\n")
        expect(readyRows(parseList(text, BusinessType.FOOD, find))).toHaveLength(50)
    })
})
