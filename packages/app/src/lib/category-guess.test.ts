import { describe, expect, it } from "vitest"

import { guessCategory } from "./category-guess.js"

describe("the category from the product name", () => {
    it("knows the everyday words, in Latin, Cyrillic and Russian", () => {
        expect(guessCategory("To'y oshi")).toBe("meals")
        expect(guessCategory("Mastava")).toBe("soups")
        expect(guessCategory("Toza suv 19 l")).toBe("water")
        expect(guessCategory("Чизбургер")).toBe("burgers")
        expect(guessCategory("Qo‘y go‘shti")).toBe("meat")
        expect(guessCategory("Latte")).toBe("drinks")
        expect(guessCategory("Tandir non")).toBe("bakery")
    })

    it("says nothing when it does not know", () => {
        expect(guessCategory("Gilam yuvish")).toBeNull()
        expect(guessCategory("")).toBeNull()
    })
})
