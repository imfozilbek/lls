import { describe, it, expect, beforeEach } from "vitest"

import {
    DomainEvent,
    OrderCreatedEvent,
    OrderStatusChangedEvent,
    CourierAssignedEvent,
    EventDispatcher,
} from "../../../domain/events/index.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"

describe("DomainEvent", () => {
    it("should have occurredOn timestamp", () => {
        const event = new OrderCreatedEvent({
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        expect(event.occurredOn).toBeInstanceOf(Date)
    })

    it("should have unique eventId", () => {
        const event1 = new OrderCreatedEvent({
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        const event2 = new OrderCreatedEvent({
            orderId: "order-2",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        expect(event1.eventId).not.toBe(event2.eventId)
    })
})

describe("OrderCreatedEvent", () => {
    it("should have correct event name", () => {
        const event = new OrderCreatedEvent({
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        expect(event.eventName).toBe("order.created")
    })

    it("should store payload correctly", () => {
        const payload = {
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        }

        const event = new OrderCreatedEvent(payload)

        expect(event.payload).toEqual(payload)
    })
})

describe("OrderStatusChangedEvent", () => {
    it("should have correct event name", () => {
        const event = new OrderStatusChangedEvent({
            orderId: "order-1",
            businessId: "business-1",
            previousStatus: OrderStatus.PENDING,
            newStatus: OrderStatus.ACCEPTED,
        })

        expect(event.eventName).toBe("order.status_changed")
    })

    it("should store status transition correctly", () => {
        const event = new OrderStatusChangedEvent({
            orderId: "order-1",
            businessId: "business-1",
            previousStatus: OrderStatus.PENDING,
            newStatus: OrderStatus.ACCEPTED,
        })

        expect(event.payload.previousStatus).toBe(OrderStatus.PENDING)
        expect(event.payload.newStatus).toBe(OrderStatus.ACCEPTED)
    })
})

describe("CourierAssignedEvent", () => {
    it("should have correct event name", () => {
        const event = new CourierAssignedEvent({
            orderId: "order-1",
            businessId: "business-1",
            courierId: "courier-1",
            courierName: "John Doe",
        })

        expect(event.eventName).toBe("order.courier_assigned")
    })

    it("should store courier info correctly", () => {
        const event = new CourierAssignedEvent({
            orderId: "order-1",
            businessId: "business-1",
            courierId: "courier-1",
            courierName: "John Doe",
        })

        expect(event.payload.courierId).toBe("courier-1")
        expect(event.payload.courierName).toBe("John Doe")
    })
})

describe("EventDispatcher", () => {
    let dispatcher: EventDispatcher

    beforeEach(() => {
        EventDispatcher.resetInstance()
        dispatcher = EventDispatcher.getInstance()
    })

    it("should return singleton instance", () => {
        const instance1 = EventDispatcher.getInstance()
        const instance2 = EventDispatcher.getInstance()

        expect(instance1).toBe(instance2)
    })

    it("should subscribe and dispatch events", async () => {
        let receivedEvent: DomainEvent | null = null

        dispatcher.subscribe("order.created", (event) => {
            receivedEvent = event
        })

        const event = new OrderCreatedEvent({
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        await dispatcher.dispatch(event)

        expect(receivedEvent).toBe(event)
    })

    it("should handle wildcard subscriptions", async () => {
        let receivedEvents: DomainEvent[] = []

        dispatcher.subscribe("*", (event) => {
            receivedEvents.push(event)
        })

        const event1 = new OrderCreatedEvent({
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        const event2 = new CourierAssignedEvent({
            orderId: "order-1",
            businessId: "business-1",
            courierId: "courier-1",
            courierName: "John Doe",
        })

        await dispatcher.dispatch(event1)
        await dispatcher.dispatch(event2)

        expect(receivedEvents).toHaveLength(2)
    })

    it("should unsubscribe handlers", async () => {
        let callCount = 0

        const handler = (): void => {
            callCount++
        }

        dispatcher.subscribe("order.created", handler)
        dispatcher.unsubscribe("order.created", handler)

        const event = new OrderCreatedEvent({
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        await dispatcher.dispatch(event)

        expect(callCount).toBe(0)
    })

    it("should clear all handlers", async () => {
        let callCount = 0

        dispatcher.subscribe("order.created", () => {
            callCount++
        })

        dispatcher.clear()

        const event = new OrderCreatedEvent({
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        await dispatcher.dispatch(event)

        expect(callCount).toBe(0)
    })

    it("should return handler count", () => {
        dispatcher.subscribe("order.created", () => {})
        dispatcher.subscribe("order.created", () => {})

        expect(dispatcher.getHandlerCount("order.created")).toBe(2)
        expect(dispatcher.getHandlerCount("order.cancelled")).toBe(0)
    })

    it("should dispatch synchronously", () => {
        let receivedEvent: DomainEvent | null = null

        dispatcher.subscribe("order.created", (event) => {
            receivedEvent = event
        })

        const event = new OrderCreatedEvent({
            orderId: "order-1",
            businessId: "business-1",
            customerId: "customer-1",
            total: { amount: 50000, currency: "UZS" },
            itemCount: 3,
        })

        dispatcher.dispatchSync(event)

        expect(receivedEvent).toBe(event)
    })
})
