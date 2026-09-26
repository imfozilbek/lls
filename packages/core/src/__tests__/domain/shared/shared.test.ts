import { describe, expect, it } from "vitest"

import { ValidationError } from "../../../domain/errors/validation.error.js"
import {
    optionalText,
    requireInteger,
    requireOneOf,
    requireText,
} from "../../../domain/shared/guards.js"
import { addDays, startOfLocalDay, toLocalTime } from "../../../domain/shared/time.js"

describe("guards", () => {
    it("requireText trims and checks length", () => {
        expect(requireText("name", "  Osh  ", 10)).toBe("Osh")
        expect(() => requireText("name", "   ", 10)).toThrow(ValidationError)
        expect(() => requireText("name", "x".repeat(11), 10)).toThrow(ValidationError)
    })

    it("optionalText turns empty into undefined", () => {
        expect(optionalText("note", undefined, 5)).toBeUndefined()
        expect(optionalText("note", null, 5)).toBeUndefined()
        expect(optionalText("note", "  ", 5)).toBeUndefined()
        expect(optionalText("note", " hi ", 5)).toBe("hi")
        expect(() => optionalText("note", "toolong", 5)).toThrow(ValidationError)
    })

    it("requireInteger rejects floats, NaN and out of range", () => {
        expect(requireInteger("q", 3, 1, 5)).toBe(3)
        for (const bad of [0, 6, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => requireInteger("q", bad, 1, 5)).toThrow(ValidationError)
        }
    })

    it("requireOneOf", () => {
        expect(requireOneOf("u", "kg", ["kg", "l"] as const)).toBe("kg")
        expect(() => requireOneOf("u", "ton", ["kg", "l"] as const)).toThrow(ValidationError)
    })
})

describe("time (UTC+5)", () => {
    it("converts UTC to Tashkent weekday and minutes", () => {
        // Sunday 2026-09-27 20:30 UTC = Monday 01:30 in Tashkent
        expect(toLocalTime(new Date("2026-09-27T20:30:00Z"))).toEqual({ weekday: 0, minutes: 90 })
        // Monday 07:00 UTC = Monday 12:00
        expect(toLocalTime(new Date("2026-09-28T07:00:00Z"))).toEqual({ weekday: 0, minutes: 720 })
        // Sunday 12:00 UTC = Sunday 17:00
        expect(toLocalTime(new Date("2026-09-27T12:00:00Z")).weekday).toBe(6)
    })

    it("startOfLocalDay is Tashkent midnight", () => {
        const start = startOfLocalDay(new Date("2026-09-28T07:15:42Z"))
        expect(start.toISOString()).toBe("2026-09-27T19:00:00.000Z")
    })

    it("addDays", () => {
        expect(addDays(new Date("2026-09-28T00:00:00Z"), -7).toISOString()).toBe(
            "2026-09-21T00:00:00.000Z",
        )
    })
})
