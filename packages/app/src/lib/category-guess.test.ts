import { describe, expect, it } from "vitest"

import { guessCategory } from "./category-guess.js"

describe("the category from the product name", () => {
    it("knows the everyday words, in Latin, Cyrillic and Russian", () => {
        expect(guessCategory("To'y oshi")).toBe("osh")
        expect(guessCategory("Manti")).toBe("dough")
        expect(guessCategory("Lavash tovuqli")).toBe("lavash")
        expect(guessCategory("Mastava")).toBe("soups")
        expect(guessCategory("Toza suv 19 l")).toBe("water")
        expect(guessCategory("Чизбургер")).toBe("burgers")
        expect(guessCategory("Qo‘y go‘shti")).toBe("meat")
        expect(guessCategory("Latte")).toBe("coffee")
        expect(guessCategory("Qora murch")).toBe("spices")
        expect(guessCategory("Sement 50 kg")).toBe("building")
        expect(guessCategory("Gilam yuvish")).toBe("carpet")
        expect(guessCategory("Tandir non")).toBe("bakery")
    })

    it("says nothing when it does not know", () => {
        expect(guessCategory("Qalam")).toBeNull()
        expect(guessCategory("")).toBeNull()
    })
})
