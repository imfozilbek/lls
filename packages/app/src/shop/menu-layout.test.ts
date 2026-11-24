import { describe, expect, it } from "vitest"

import { StorefrontLayout } from "@zumda/core"
import {
    NEW_CHIP,
    NEW_SHELF_MAX,
    newArrivals,
    newShelf,
    prefersList,
    resolveLayout,
    shelvesOf,
    underChip,
    viewOf,
} from "./menu-layout.js"

import type { ProductDTO } from "@zumda/core"

function product(id: string, fields: Partial<ProductDTO> = {}): ProductDTO {
    return { id, category: "baby_goods", position: 0, ...fields } as ProductDTO
}

const photo = { imageKey: "shops/x/p.webp" }

describe("the storefront's layout (goal 24)", () => {
    it("is the owner's choice; until then the photos decide", () => {
        const pictured = [product("a", photo), product("b", photo), product("c")]
        const plain = [product("a", photo), product("b"), product("c")]
        expect(prefersList(plain)).toBe(true)
        expect(resolveLayout(null, pictured)).toBe(StorefrontLayout.GRID)
        expect(resolveLayout(null, plain)).toBe(StorefrontLayout.LIST)
        expect(resolveLayout(StorefrontLayout.FEED, plain)).toBe(StorefrontLayout.FEED)
    })

    it("shelves show the whole catalog; a tab or a search shows two columns", () => {
        expect(viewOf(StorefrontLayout.SHELVES, false)).toBe(StorefrontLayout.SHELVES)
        expect(viewOf(StorefrontLayout.SHELVES, true)).toBe(StorefrontLayout.GRID)
        expect(viewOf(StorefrontLayout.FEED, true)).toBe(StorefrontLayout.FEED)
        expect(viewOf(StorefrontLayout.LIST, true)).toBe(StorefrontLayout.LIST)
    })

    it("a shelf a category, the fullest first, a product on each of its categories", () => {
        const kubik = product("kubik", { category: "logic_games", moreCategories: ["books"] })
        const ertak = product("ertak", { category: "books" })
        const shaqildoq = product("shaqildoq", { category: "educational_toys" })
        const shelves = shelvesOf([shaqildoq, kubik, ertak])
        expect(shelves.map((s) => s.category)).toEqual(["books", "educational_toys", "logic_games"])
        expect(shelves[0]?.products.map((p) => p.id)).toEqual(["kubik", "ertak"])
    })
})

describe("«Yangi kelganlar»", () => {
    const at = (day: number): string => new Date(Date.UTC(2026, 10, day)).toISOString()

    it("the newest first, at most ten, none while fewer than three are new", () => {
        const two = [product("a", { addedAt: at(1) }), product("b", { addedAt: at(2) })]
        expect(newShelf([...two, product("old")])).toEqual([])
        const many = Array.from({ length: 12 }, (_, i) => product(`p${i}`, { addedAt: at(i + 1) }))
        const shelf = newShelf(many)
        expect(shelf).toHaveLength(NEW_SHELF_MAX)
        expect(shelf[0]?.id).toBe("p11")
        // «Hammasini ko'rish» shows every new one, not only the shelf's ten.
        expect(newArrivals(many)).toHaveLength(12)
    })

    it("its tab shows the new products; the others keep their own tabs", () => {
        const fresh = product("fresh", { addedAt: at(3), category: "books" })
        const old = product("old", { category: "books" })
        expect(underChip(fresh, NEW_CHIP)).toBe(true)
        expect(underChip(old, NEW_CHIP)).toBe(false)
        expect(underChip(old, "books")).toBe(true)
    })
})
