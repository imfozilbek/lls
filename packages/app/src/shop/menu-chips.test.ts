import { describe, expect, it } from "vitest"

import { matchesChip, menuChips } from "./menu-chips.js"

import type { ProductDTO } from "@zumda/core"

function product(id: string, fields: Partial<ProductDTO>): ProductDTO {
    return { id, category: "baby_goods", ...fields } as ProductDTO
}

const kubik = product("kubik", {
    category: "logic_games",
    moreCategories: ["books"],
    ageFrom: 3,
})
const shaqildoq = product("shaqildoq", { category: "educational_toys", ageFrom: 0 })
const ertak = product("ertak", { category: "books", ageFrom: 5 })

describe("the storefront's tabs", () => {
    it("ages first, from the youngest, then every category a product stands in", () => {
        expect(menuChips([kubik, shaqildoq, ertak])).toEqual([
            "0+",
            "3+",
            "5+",
            "logic_games",
            "books",
            "educational_toys",
        ])
    })

    it("one age is no tab; one category alone is still a tab for the row to judge", () => {
        expect(menuChips([kubik, product("x", { category: "books", ageFrom: 3 })])).toEqual([
            "logic_games",
            "books",
        ])
        expect(menuChips([product("osh", { category: "meals" })])).toEqual(["meals"])
    })

    it("a tab shows the products of its age, or standing in its category as any of theirs", () => {
        const all = [kubik, shaqildoq, ertak]
        const under = (chip: string): string[] =>
            all.filter((p) => matchesChip(p, chip)).map((p) => p.id)
        expect(under("3+")).toEqual(["kubik"])
        expect(under("0+")).toEqual(["shaqildoq"])
        expect(under("books")).toEqual(["kubik", "ertak"])
        expect(under("educational_toys")).toEqual(["shaqildoq"])
        expect(under("1+")).toEqual([])
    })
})
