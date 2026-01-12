import { describe, it, expect } from "vitest"

import { Phone } from "../../../domain/value-objects/phone.js"

describe("Phone", () => {
    describe("create", () => {
        it("should create phone with valid Uzbekistan number", () => {
            const phone = Phone.create("+998901234567")
            expect(phone.number).toBe("+998901234567")
        })

        it("should throw on invalid format", () => {
            expect(() => Phone.create("invalid")).toThrow()
        })

        it("should throw on non-Uzbekistan number", () => {
            expect(() => Phone.create("+1234567890")).toThrow()
        })
    })

    describe("isValid", () => {
        it("should return true for valid number", () => {
            expect(Phone.isValid("+998901234567")).toBe(true)
        })

        it("should return false for invalid number", () => {
            expect(Phone.isValid("invalid")).toBe(false)
        })
    })

    describe("format", () => {
        it("should format phone number", () => {
            const phone = Phone.create("+998901234567")
            const formatted = phone.format()
            expect(formatted).toContain("998")
        })
    })

    describe("equals", () => {
        it("should return true for equal phones", () => {
            const a = Phone.create("+998901234567")
            const b = Phone.create("+998901234567")
            expect(a.equals(b)).toBe(true)
        })

        it("should return false for different phones", () => {
            const a = Phone.create("+998901234567")
            const b = Phone.create("+998909876543")
            expect(a.equals(b)).toBe(false)
        })
    })
})
