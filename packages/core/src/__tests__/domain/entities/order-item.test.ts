import { describe, it, expect } from "vitest"

import { OrderItem } from "../../../domain/entities/order-item.js"
import { Money } from "../../../domain/value-objects/money.js"

describe("OrderItem", () => {
    const createOrderItem = (): OrderItem => {
        return OrderItem.create({
            id: "item-id",
            productId: "prod-id",
            productName: "Test Product",
            quantity: 2,
            unitPrice: Money.create(10000),
        })
    }

    describe("create", () => {
        it("should create order item with valid data", () => {
            const item = createOrderItem()
            expect(item.id).toBe("item-id")
            expect(item.productName).toBe("Test Product")
            expect(item.quantity).toBe(2)
        })

        it("should throw on zero quantity", () => {
            expect(() =>
                OrderItem.create({
                    id: "item-id",
                    productId: "prod-id",
                    productName: "Test Product",
                    quantity: 0,
                    unitPrice: Money.create(10000),
                }),
            ).toThrow()
        })

        it("should throw on negative quantity", () => {
            expect(() =>
                OrderItem.create({
                    id: "item-id",
                    productId: "prod-id",
                    productName: "Test Product",
                    quantity: -1,
                    unitPrice: Money.create(10000),
                }),
            ).toThrow()
        })
    })

    describe("total", () => {
        it("should calculate total correctly", () => {
            const item = createOrderItem()
            expect(item.total.amount).toBe(20000)
        })
    })

    describe("updateQuantity", () => {
        it("should update quantity", () => {
            const item = createOrderItem()
            item.updateQuantity(5)
            expect(item.quantity).toBe(5)
            expect(item.total.amount).toBe(50000)
        })

        it("should throw on invalid quantity", () => {
            const item = createOrderItem()
            expect(() => item.updateQuantity(0)).toThrow()
        })
    })

    describe("toJSON", () => {
        it("should serialize to JSON", () => {
            const item = createOrderItem()
            const json = item.toJSON()
            expect(json.id).toBe("item-id")
            expect(json.quantity).toBe(2)
        })
    })
})
