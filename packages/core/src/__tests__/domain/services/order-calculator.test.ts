import { describe, it, expect } from "vitest"

import {
    calculateOrderTotal,
    calculateDiscount,
    applyDiscount,
    formatOrderSummary,
} from "../../../domain/services/order-calculator.js"
import { Money } from "../../../domain/value-objects/money.js"

describe("calculateOrderTotal", () => {
    it("should calculate subtotal correctly", () => {
        const items = [
            { price: Money.create(10000, "UZS"), quantity: 2 },
            { price: Money.create(15000, "UZS"), quantity: 1 },
        ]

        const result = calculateOrderTotal(items)

        expect(result.subtotal.amount).toBe(35000)
    })

    it("should add delivery fee for orders below threshold", () => {
        const items = [{ price: Money.create(10000, "UZS"), quantity: 1 }]

        const result = calculateOrderTotal(items, 15000, 100000)

        expect(result.deliveryFee.amount).toBe(15000)
        expect(result.total.amount).toBe(25000)
    })

    it("should have free delivery for orders above threshold", () => {
        const items = [{ price: Money.create(50000, "UZS"), quantity: 3 }]

        const result = calculateOrderTotal(items, 15000, 100000)

        expect(result.deliveryFee.amount).toBe(0)
        expect(result.total.amount).toBe(150000)
    })

    it("should count items correctly", () => {
        const items = [
            { price: Money.create(10000, "UZS"), quantity: 2 },
            { price: Money.create(15000, "UZS"), quantity: 3 },
        ]

        const result = calculateOrderTotal(items)

        expect(result.itemCount).toBe(5)
    })

    it("should handle empty items array", () => {
        const result = calculateOrderTotal([])

        expect(result.subtotal.amount).toBe(0)
        expect(result.deliveryFee.amount).toBe(0)
        expect(result.total.amount).toBe(0)
        expect(result.itemCount).toBe(0)
    })

    it("should use default delivery fee", () => {
        const items = [{ price: Money.create(10000, "UZS"), quantity: 1 }]

        const result = calculateOrderTotal(items)

        expect(result.deliveryFee.amount).toBe(15000) // Default: 15,000 UZS
    })
})

describe("calculateDiscount", () => {
    it("should calculate percentage discount correctly", () => {
        const subtotal = Money.create(100000, "UZS")
        const discount = calculateDiscount(subtotal, 10)

        expect(discount.amount).toBe(10000)
    })

    it("should return 0 for 0% discount", () => {
        const subtotal = Money.create(100000, "UZS")
        const discount = calculateDiscount(subtotal, 0)

        expect(discount.amount).toBe(0)
    })

    it("should return 0 for negative discount", () => {
        const subtotal = Money.create(100000, "UZS")
        const discount = calculateDiscount(subtotal, -10)

        expect(discount.amount).toBe(0)
    })

    it("should return 0 for discount > 100%", () => {
        const subtotal = Money.create(100000, "UZS")
        const discount = calculateDiscount(subtotal, 150)

        expect(discount.amount).toBe(0)
    })

    it("should round discount amount", () => {
        const subtotal = Money.create(10001, "UZS")
        const discount = calculateDiscount(subtotal, 10)

        expect(discount.amount).toBe(1000) // Rounded
    })
})

describe("applyDiscount", () => {
    it("should apply discount to order", () => {
        const calculation = {
            subtotal: Money.create(100000, "UZS"),
            deliveryFee: Money.create(15000, "UZS"),
            total: Money.create(115000, "UZS"),
            itemCount: 5,
        }

        const result = applyDiscount(calculation, 10)

        expect(result.discount.amount).toBe(10000)
        expect(result.subtotal.amount).toBe(90000)
        expect(result.total.amount).toBe(105000) // 90000 + 15000
    })

    it("should preserve delivery fee", () => {
        const calculation = {
            subtotal: Money.create(100000, "UZS"),
            deliveryFee: Money.create(15000, "UZS"),
            total: Money.create(115000, "UZS"),
            itemCount: 5,
        }

        const result = applyDiscount(calculation, 10)

        expect(result.deliveryFee.amount).toBe(15000)
    })

    it("should not go below 0", () => {
        const calculation = {
            subtotal: Money.create(10000, "UZS"),
            deliveryFee: Money.create(15000, "UZS"),
            total: Money.create(25000, "UZS"),
            itemCount: 1,
        }

        const result = applyDiscount(calculation, 100)

        expect(result.subtotal.amount).toBe(0)
        expect(result.total.amount).toBe(15000)
    })
})

describe("formatOrderSummary", () => {
    it("should format summary correctly", () => {
        const calculation = {
            subtotal: Money.create(100000, "UZS"),
            deliveryFee: Money.create(15000, "UZS"),
            total: Money.create(115000, "UZS"),
            itemCount: 5,
        }

        const summary = formatOrderSummary(calculation)

        expect(summary).toContain("Subtotal:")
        expect(summary).toContain("Delivery:")
        expect(summary).toContain("Total:")
        expect(summary).toContain("Items: 5")
    })

    it("should show Free for zero delivery fee", () => {
        const calculation = {
            subtotal: Money.create(150000, "UZS"),
            deliveryFee: Money.create(0, "UZS"),
            total: Money.create(150000, "UZS"),
            itemCount: 10,
        }

        const summary = formatOrderSummary(calculation)

        expect(summary).toContain("Delivery: Free")
    })
})
