import { describe, expect, it } from "vitest"

import { ru } from "./ru.js"
import { uz } from "./uz.js"

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
    const uzLeaves = leaves(uz)
    const ruLeaves = leaves(ru)

    it("have the same keys", () => {
        expect([...ruLeaves.keys()].sort()).toEqual([...uzLeaves.keys()].sort())
    })

    it("have no empty texts and the same list lengths", () => {
        for (const [path, value] of uzLeaves) {
            const other = ruLeaves.get(path)
            if (Array.isArray(value)) {
                expect(Array.isArray(other) && other.length, path).toBe(value.length)
            } else {
                expect(String(value).trim(), path).not.toBe("")
                expect(String(other).trim(), path).not.toBe("")
            }
        }
    })

    it("use the same placeholders", () => {
        for (const [path, value] of uzLeaves) {
            expect(placeholders(ruLeaves.get(path)), path).toEqual(placeholders(value))
        }
    })
})
