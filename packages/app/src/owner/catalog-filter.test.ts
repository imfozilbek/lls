import { describe, expect, it } from "vitest"

import { filterCounts, inFilter, shownFilters } from "./catalog-filter.js"

import type { ProductDTO } from "@zumda/core"

const TOMORROW = new Date(Date.now() + 86_400_000).toISOString()

function product(fields: Partial<ProductDTO>): ProductDTO {
    return { isAvailable: true, imageKey: "p.jpg", ...fields } as ProductDTO
}

describe("the catalog's state chips", () => {
    it("on sale, off for today, hidden, without a photo", () => {
        const today = product({ unavailableUntil: TOMORROW })
        expect(inFilter(today, "today")).toBe(true)
        expect(inFilter(today, "onSale")).toBe(false)
        expect(inFilter(product({ isAvailable: false }), "hidden")).toBe(true)
        expect(inFilter(product({ imageKey: undefined }), "noPhoto")).toBe(true)
        expect(inFilter(product({}), "onSale")).toBe(true)
        // Counted and none left: on its own chip, not «Sotuvda».
        const gone = product({ stock: 0, soldOut: true })
        expect(inFilter(gone, "soldOut")).toBe(true)
        expect(inFilter(gone, "onSale")).toBe(false)
        expect(inFilter(product({ stock: 4 }), "soldOut")).toBe(false)
    })

    it("counts each chip and shows them only when something is off sale or has no photo", () => {
        const all = [product({}), product({ isAvailable: false }), product({ imageKey: undefined })]
        const counts = filterCounts(all)
        expect(counts).toEqual({ all: 3, onSale: 2, soldOut: 0, today: 0, hidden: 1, noPhoto: 1 })
        expect(shownFilters(counts)).toEqual(["all", "onSale", "hidden", "noPhoto"])
        expect(shownFilters(filterCounts([product({}), product({})]))).toEqual([])
        const gone = filterCounts([product({}), product({ stock: 0, soldOut: true })])
        expect(shownFilters(gone)).toEqual(["all", "onSale", "soldOut"])
    })
})
