import { describe, it, expect } from "vitest"

import { Money } from "../../../domain/value-objects/money.js"

describe("Money", () => {
    describe("create", () => {
        it("should create money with valid amount", () => {
            const money = Money.create(100)
            expect(money.amount).toBe(100)
            expect(money.currency).toBe("UZS")
        })

        it("should create money with custom currency", () => {
            const money = Money.create(50, "USD")
            expect(money.amount).toBe(50)
            expect(money.currency).toBe("USD")
        })

        it("should throw on negative amount", () => {
            expect(() => Money.create(-10)).toThrow()
        })
    })

    describe("zero", () => {
        it("should create zero money", () => {
            const money = Money.zero()
            expect(money.amount).toBe(0)
            expect(money.isZero()).toBe(true)
        })
    })

    describe("add", () => {
        it("should add two money values", () => {
            const a = Money.create(100)
            const b = Money.create(50)
            const result = a.add(b)
            expect(result.amount).toBe(150)
        })

        it("should throw on currency mismatch", () => {
            const a = Money.create(100, "UZS")
            const b = Money.create(50, "USD")
            expect(() => a.add(b)).toThrow()
        })
    })

    describe("subtract", () => {
        it("should subtract money values", () => {
            const a = Money.create(100)
            const b = Money.create(30)
            const result = a.subtract(b)
            expect(result.amount).toBe(70)
        })
    })

    describe("multiply", () => {
        it("should multiply money by factor", () => {
            const money = Money.create(100)
            const result = money.multiply(3)
            expect(result.amount).toBe(300)
        })
    })

    describe("equals", () => {
        it("should return true for equal money", () => {
            const a = Money.create(100)
            const b = Money.create(100)
            expect(a.equals(b)).toBe(true)
        })

        it("should return false for different amounts", () => {
            const a = Money.create(100)
            const b = Money.create(200)
            expect(a.equals(b)).toBe(false)
        })
    })

    describe("isGreaterThan", () => {
        it("should compare money values", () => {
            const a = Money.create(100)
            const b = Money.create(50)
            expect(a.isGreaterThan(b)).toBe(true)
            expect(b.isGreaterThan(a)).toBe(false)
        })
    })

    describe("format", () => {
        it("should format money as string", () => {
            const money = Money.create(1000)
            expect(money.format()).toContain("UZS")
        })
    })
})
