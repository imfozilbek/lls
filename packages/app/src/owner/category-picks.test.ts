import { describe, expect, it } from "vitest"

import { asksAge, togglePick, usedCategories } from "./category-picks.js"

import type { ProductDTO } from "@zumda/core"

const toy = { category: "logic_games" as const, moreCategories: [] }

describe("togglePick", () => {
    it("a tap replaces a guessed category, then adds and removes", () => {
        expect(togglePick({ category: "household", moreCategories: [] }, "books", false)).toEqual({
            category: "books",
            moreCategories: [],
        })
        const two = togglePick(toy, "books", true)
        expect(two).toEqual({ category: "logic_games", moreCategories: ["books"] })
        const three = two && togglePick(two, "educational_toys", true)
        expect(three).toEqual({
            category: "logic_games",
            moreCategories: ["books", "educational_toys"],
        })
        // A fourth has no room.
        expect(three && togglePick(three, "baby_goods", true)).toBeNull()
        // The main one goes: the next takes its place.
        expect(three && togglePick(three, "logic_games", true)).toEqual({
            category: "books",
            moreCategories: ["educational_toys"],
        })
        // The last one stays.
        expect(togglePick(toy, "logic_games", true)).toEqual(toy)
    })
})

describe("usedCategories", () => {
    it("the shop's categories, the most used first, further ones counted too", () => {
        const product = (category: string, more?: string[]): ProductDTO =>
            ({ category, moreCategories: more }) as unknown as ProductDTO
        const used = usedCategories([
            product("books"),
            product("logic_games", ["books"]),
            product("educational_toys", ["books", "logic_games"]),
        ])
        expect(used).toEqual(["books", "logic_games", "educational_toys"])
        expect(usedCategories(null)).toEqual([])
    })
})

describe("asksAge", () => {
    it("children's goods ask for an age, other goods do not", () => {
        expect(asksAge(toy)).toBe(true)
        expect(asksAge({ category: "household", moreCategories: ["baby_goods"] })).toBe(true)
        expect(asksAge({ category: "meals", moreCategories: [] })).toBe(false)
    })
})
