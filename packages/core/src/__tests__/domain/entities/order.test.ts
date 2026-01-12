import { describe, it, expect } from "vitest"

import { Order } from "../../../domain/entities/order.js"
import { OrderItem } from "../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"
import { Address } from "../../../domain/value-objects/address.js"
import { Money } from "../../../domain/value-objects/money.js"

describe("Order", () => {
    const createOrderItem = (): OrderItem => {
        return OrderItem.create({
            id: "item-id",
            productId: "prod-id",
            productName: "Test Product",
            quantity: 2,
            unitPrice: Money.create(10000),
        })
    }

    const createOrder = (): Order => {
        return Order.create({
            id: "order-id",
            customerId: "cust-id",
            businessId: "biz-id",
            items: [createOrderItem()],
            deliveryAddress: Address.create("Main St", "Tashkent"),
        })
    }

    describe("create", () => {
        it("should create order with valid data", () => {
            const order = createOrder()
            expect(order.id).toBe("order-id")
            expect(order.status).toBe(OrderStatus.PENDING)
            expect(order.courierId).toBeUndefined()
        })

        it("should calculate total from items", () => {
            const order = createOrder()
            expect(order.total.amount).toBe(20000)
        })

        it("should throw on empty items", () => {
            expect(() =>
                Order.create({
                    id: "order-id",
                    customerId: "cust-id",
                    businessId: "biz-id",
                    items: [],
                    deliveryAddress: Address.create("Main St", "Tashkent"),
                }),
            ).toThrow()
        })
    })

    describe("status transitions", () => {
        it("should accept order", () => {
            const order = createOrder()
            order.accept()
            expect(order.status).toBe(OrderStatus.ACCEPTED)
        })

        it("should start preparing", () => {
            const order = createOrder()
            order.accept()
            order.startPreparing()
            expect(order.status).toBe(OrderStatus.PREPARING)
        })

        it("should mark ready", () => {
            const order = createOrder()
            order.accept()
            order.startPreparing()
            order.markReady()
            expect(order.status).toBe(OrderStatus.READY)
        })

        it("should pickup with courier", () => {
            const order = createOrder()
            order.accept()
            order.startPreparing()
            order.markReady()
            order.assignCourier("courier-id")
            order.pickup()
            expect(order.status).toBe(OrderStatus.PICKED_UP)
        })

        it("should deliver", () => {
            const order = createOrder()
            order.accept()
            order.startPreparing()
            order.markReady()
            order.assignCourier("courier-id")
            order.pickup()
            order.deliver()
            expect(order.status).toBe(OrderStatus.DELIVERED)
        })

        it("should cancel pending order", () => {
            const order = createOrder()
            order.cancel()
            expect(order.status).toBe(OrderStatus.CANCELLED)
        })

        it("should throw on invalid transition", () => {
            const order = createOrder()
            expect(() => order.deliver()).toThrow()
        })
    })

    describe("assignCourier", () => {
        it("should assign courier to order", () => {
            const order = createOrder()
            order.assignCourier("courier-id")
            expect(order.courierId).toBe("courier-id")
        })

        it("should throw when courier already assigned", () => {
            const order = createOrder()
            order.assignCourier("courier-1")
            expect(() => order.assignCourier("courier-2")).toThrow()
        })
    })

    describe("query methods", () => {
        it("should check if pending", () => {
            const order = createOrder()
            expect(order.isPending()).toBe(true)
        })

        it("should check if active", () => {
            const order = createOrder()
            order.accept()
            expect(order.isActive()).toBe(true)
        })

        it("should check if completed", () => {
            const order = createOrder()
            order.accept()
            order.startPreparing()
            order.markReady()
            order.assignCourier("courier-id")
            order.pickup()
            order.deliver()
            expect(order.isCompleted()).toBe(true)
        })

        it("should check if cancelled", () => {
            const order = createOrder()
            order.cancel()
            expect(order.isCancelled()).toBe(true)
        })
    })
})
