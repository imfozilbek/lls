import { describe, expect, it } from "vitest"

import { BUSINESS_TYPES, BusinessType, LANGUAGES, Language } from "@zumda/core"

import "./staff-register.js"

import { dictionaryFor } from "./index.js"
import { staffUz } from "./staff.js"
import { uz as base } from "./uz.js"

// The staff chunk adds its words, and its error words join the customer's.
const uz = { ...base, ...staffUz, errors: { ...base.errors, ...staffUz.staffErrors } }

/** "a.b.c" → value, for every leaf; arrays count as leaves with their length. */
function leaves(value: unknown, prefix = ""): Map<string, unknown> {
    const out = new Map<string, unknown>()
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        for (const [key, child] of Object.entries(value)) {
            for (const [path, leaf] of leaves(child, prefix ? `${prefix}.${key}` : key)) {
                out.set(path, leaf)
            }
        }
    } else {
        out.set(prefix, value)
    }
    return out
}

const placeholders = (text: unknown): string[] =>
    typeof text === "string" ? [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort() : []

describe("dictionaries", () => {
    it("every language has every text, with no empty ones", () => {
        const uzLeaves = leaves(uz)
        for (const language of LANGUAGES) {
            const own = leaves(dictionaryFor(language))
            expect([...own.keys()].sort()).toEqual([...uzLeaves.keys()].sort())
            for (const [path, value] of own) {
                if (!Array.isArray(value)) {
                    expect(String(value).trim(), path).not.toBe("")
                }
                expect(placeholders(value), path).toEqual(placeholders(uzLeaves.get(path)))
            }
        }
    })

    it("speak Uzbek (Latin) only: no Cyrillic in any text", () => {
        for (const language of LANGUAGES) {
            for (const type of BUSINESS_TYPES) {
                for (const [path, value] of leaves(dictionaryFor(language, type))) {
                    expect(String(value), path).not.toMatch(/[\u0400-\u04FF]/)
                }
            }
        }
    })
})

describe("words by business type", () => {
    it("food shops talk about a menu and cooking", () => {
        const food = dictionaryFor(Language.UZ, BusinessType.FOOD)
        expect(food.owner.tabs.menu).toBe("Menyu")
        expect(food.order.steps.preparing).toBe("Tayyorlanmoqda")
        expect(food.order.hints.delivered).toContain("ishtaha")
    })

    it("grocery stores (water too) get the neutral words", () => {
        const words = dictionaryFor(Language.UZ, BusinessType.GROCERY)
        expect(words.owner.tabs.menu).toBe(uz.owner.tabs.menu)
        expect(words.order.hints.delivered).not.toContain("ishtaha")
    })

    it("services talk about services and work being done", () => {
        const service = dictionaryFor(Language.UZ, BusinessType.SERVICE)
        expect(service.owner.tabs.menu).toBe("Xizmatlar")
        expect(service.order.steps.preparing).toBe("Bajarilmoqda")
        expect(service.onboarding.types[BusinessType.SERVICE]).toBe("Xizmat ko'rsatish")
    })

    it("every overlay keeps every placeholder", () => {
        for (const language of LANGUAGES) {
            for (const type of BUSINESS_TYPES) {
                const overlay = leaves(dictionaryFor(language, type))
                for (const [path, value] of leaves(dictionaryFor(language))) {
                    expect(placeholders(overlay.get(path)), path).toEqual(placeholders(value))
                }
            }
        }
    })
})
