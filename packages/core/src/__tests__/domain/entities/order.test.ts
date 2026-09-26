import { describe, expect, it } from "vitest"

import { MAX_ORDER_LINES, Order } from "../../../domain/entities/order.js"
import { OrderItem } from "../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"
import { Unit } from "../../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { InvalidOrderTransitionError } from "../../../domain/errors/invalid-transition.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { Money } from "../../../domain/value-objects/money.js"

function item(quantity = 2, price = 35_000): OrderItem {
    return OrderItem.create({
        productId: "prod-1",
        name: "Osh",
        unit: Unit.PORTION,
        unitPrice: Money.of(price),
        quantity,
    })
}

function placeOrder(items: OrderItem[] = [item()]): Order {
    return Order.place({
        id: "order-1",
        businessId: "biz-1",
        customerId: "cust-1",
        number: 1,
        items,
        deliveryFee: Money.of(10_000),
        address: "Navoiy ko'chasi 12",
        landmark: "Maktab yonida",
        customerName: "Aziz",
    })
}

describe("OrderItem", () => {
    it("computes total and validates quantity", () => {
        expect(item(3, 10_000).total.amount).toBe(30_000)
        expect(() => item(0)).toThrow(ValidationError)
        expect(() => item(100)).toThrow(ValidationError)
        expect(() => item(1.5)).toThrow(ValidationError)
    })
})

describe("Order", () => {
    it("is placed as pending with server-side totals", () => {
        const order = placeOrder()
        expect(order.status).toBe(OrderStatus.PENDING)
        expect(order.subtotal.amount).toBe(70_000)
        expect(order.deliveryFee.amount).toBe(10_000)
        expect(order.total.amount).toBe(80_000)
        expect(order.landmark).toBe("Maktab yonida")
        expect(order.isPlacedBy("cust-1")).toBe(true)
        expect(order.nextStatus()).toBe(OrderStatus.ACCEPTED)
    })

    it("rejects empty, oversized and address-less orders", () => {
        expect(() => placeOrder([])).toThrow(BusinessRuleViolationError)
        const many = Array.from({ length: MAX_ORDER_LINES + 1 }, () => item(1))
        expect(() => placeOrder(many)).toThrow(/at most/)
        expect(() =>
            Order.place({
                id: "o",
                businessId: "b",
                customerId: "c",
                number: 1,
                items: [item()],
                deliveryFee: Money.zero(),
                address: " ",
                customerName: "A",
            }),
        ).toThrow(ValidationError)
    })

    it("moves forward step by step", () => {
        const order = placeOrder()
        for (const status of [
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.PICKED_UP,
            OrderStatus.DELIVERED,
        ]) {
            order.advanceTo(status)
            expect(order.status).toBe(status)
        }
        expect(order.isFinal()).toBe(true)
        expect(order.nextStatus()).toBeNull()
    })

    it("does not skip steps or cancel through advanceTo", () => {
        const order = placeOrder()
        expect(() => order.advanceTo(OrderStatus.READY)).toThrow(InvalidOrderTransitionError)
        expect(() => order.advanceTo(OrderStatus.CANCELLED)).toThrow(ValidationError)
    })

    it("customer can cancel only while pending", () => {
        const pending = placeOrder()
        pending.cancel("customer", "Adashdim")
        expect(pending.status).toBe(OrderStatus.CANCELLED)
        expect(pending.cancelledBy).toBe("customer")
        expect(pending.cancelReason).toBe("Adashdim")

        const accepted = placeOrder()
        accepted.advanceTo(OrderStatus.ACCEPTED)
        expect(() => accepted.cancel("customer")).toThrow(BusinessRuleViolationError)
    })

    it("owner can cancel any active order, but not a final one", () => {
        const order = placeOrder()
        order.advanceTo(OrderStatus.ACCEPTED)
        order.advanceTo(OrderStatus.PREPARING)
        order.cancel("owner", "Tugab qoldi")
        expect(order.cancelledBy).toBe("owner")
        expect(() => order.cancel("owner")).toThrow(InvalidOrderTransitionError)
    })

    it("reconstitutes from stored props", () => {
        const order = placeOrder()
        const copy = Order.reconstitute({
            id: order.id,
            businessId: order.businessId,
            customerId: order.customerId,
            number: 7,
            items: order.items,
            subtotal: order.subtotal,
            deliveryFee: order.deliveryFee,
            total: order.total,
            status: OrderStatus.READY,
            address: order.address,
            customerName: order.customerName,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        })
        expect(copy.number).toBe(7)
        expect(copy.status).toBe(OrderStatus.READY)
        expect(copy.items).toHaveLength(1)
    })
})
