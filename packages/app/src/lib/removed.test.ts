import { Language } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { dictionaryFor } from "../i18n/index.js"

import { removedText } from "./removed.js"

import type { ProductDTO } from "@zumda/core"

const t = dictionaryFor(Language.UZ)
const named = (id: string, name: string): ProductDTO => ({ id, name }) as ProductDTO

describe("removedText", () => {
    it("a product gone from the menu is gone; one still on it only changed", () => {
        const seen = [named("lagmon", "Lag'mon"), named("latte", "Latte")]
        expect(removedText(t, ["lagmon"], seen, [named("latte", "Latte")])).toBe(
            "«Lag'mon» endi yo'q: savatdan olib tashladik.",
        )
        expect(removedText(t, ["latte"], seen, [named("latte", "Latte")])).toBe(
            "«Latte» o'zgardi: savatdan olib tashladik, qaytadan tanlang.",
        )
    })

    it("without the names: how many", () => {
        expect(removedText(t, ["x", "y"], [], [])).toBe(
            "Savatdagi 2 ta mahsulot endi yo'q yoki o'zgardi, ularni olib tashladik.",
        )
    })
})
