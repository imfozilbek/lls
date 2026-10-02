import { describe, expect, it } from "vitest"

import { MAX_ORDER_LINES, Order } from "../../../domain/entities/order.js"
import { OrderItem } from "../../../domain/entities/order-item.js"
import { OrderChannel } from "../../../domain/enums/order-channel.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"
import { PaidWith, PaymentMethod } from "../../../domain/enums/payment.js"
import { Unit } from "../../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { InvalidOrderTransitionError } from "../../../domain/errors/invalid-transition.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { Money } from "../../../domain/value-objects/money.js"
import { Payment } from "../../../domain/value-objects/payment.js"
import { makeCourier } from "../../fixtures.js"

import type { Courier } from "../../../domain/entities/courier.js"
import type { PlaceOrderProps } from "../../../domain/entities/order.js"

const NOW = new Date()

function item(quantity = 2, price = 35_000, unit: Unit = Unit.PORTION): OrderItem {
    return OrderItem.create({
        productId: "prod-1",
        name: "Osh",
        unit,
        category: "meals",
        unitPrice: Money.of(price),
        quantity,
    })
}

function placeOrder(items: OrderItem[] = [item()], extra: Partial<PlaceOrderProps> = {}): Order {
    return Order.place({
        id: "order-1",
        businessId: "biz-1",
        customerId: "cust-1",
        number: 1,
        channel: OrderChannel.SHOP_BOT,
        commissionBps: 0,
        items,
        deliveryFee: Money.of(10_000),
        address: "Navoiy ko'chasi 12",
        landmark: "Maktab yonida",
        customerName: "Aziz",
        ...extra,
    })
}

function courier(businessId = "biz-1", id = "courier-1"): Courier {
    return makeCourier({ id, businessId, now: NOW })
}

function readyOrder(): Order {
    const order = placeOrder()
    order.advanceTo(OrderStatus.ACCEPTED)
    order.advanceTo(OrderStatus.PREPARING)
    order.advanceTo(OrderStatus.READY)
    return order
}

describe("OrderItem", () => {
    it("computes totals for pieces and validates quantity", () => {
        expect(item(3, 10_000).total.amount).toBe(30_000)
        expect(item(3).category).toBe("meals")
        expect(() => item(0)).toThrow(ValidationError)
        expect(() => item(1.5)).toThrow(ValidationError)
    })

    it("weight items count grams and round to whole sum", () => {
        expect(item(1500, 12_000, Unit.KG).total.amount).toBe(18_000)
        expect(item(333, 10_000, Unit.KG).total.amount).toBe(3_330)
        expect(item(250, 9_999, Unit.KG).total.amount).toBe(2_500)
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

    it("own-bot orders carry no commission; marketplace orders snapshot it on goods only", () => {
        const own = placeOrder()
        expect(own.channel).toBe(OrderChannel.SHOP_BOT)
        expect(own.commission.amount).toBe(0)

        const market = placeOrder([item()], {
            channel: OrderChannel.MARKETPLACE,
            commissionBps: 750,
            depositTotal: Money.of(20_000),
        })
        // 7.5% of 70 000 goods; delivery and deposit are not commissioned.
        expect(market.commission.amount).toBe(5_250)
        expect(market.commissionBps).toBe(750)
    })

    it("adds the bottle deposit to the total", () => {
        const order = placeOrder([item()], { depositTotal: Money.of(30_000), bottlesReturned: 1 })
        expect(order.total.amount).toBe(70_000 + 10_000 + 30_000)
        expect(order.bottlesReturned).toBe(1)
        expect(() => placeOrder([item()], { bottlesReturned: 100 })).toThrow(ValidationError)
    })

    it("rejects empty, oversized and address-less orders", () => {
        expect(() => placeOrder([])).toThrow(BusinessRuleViolationError)
        const many = Array.from({ length: MAX_ORDER_LINES + 1 }, () => item(1))
        expect(() => placeOrder(many)).toThrow(/at most/)
        expect(() => placeOrder([item()], { address: " " })).toThrow(ValidationError)
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
            order.advanceTo(status, undefined, PaidWith.CASH)
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
            channel: order.channel,
            items: order.items,
            subtotal: order.subtotal,
            deliveryFee: order.deliveryFee,
            depositTotal: order.depositTotal,
            bottlesReturned: 0,
            total: order.total,
            commissionBps: 0,
            commission: Money.zero(),
            payment: Payment.start(PaymentMethod.CASH),
            status: OrderStatus.READY,
            courierId: "courier-1",
            courierName: "Jasur",
            address: order.address,
            customerName: order.customerName,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        })
        expect(copy.number).toBe(7)
        expect(copy.status).toBe(OrderStatus.READY)
        expect(copy.items).toHaveLength(1)
        expect(copy.isAssignedTo("courier-1")).toBe(true)
    })
})

describe("Order and couriers", () => {
    it("the owner assigns a courier of the shop between accepted and ready", () => {
        const order = placeOrder()
        expect(() => order.assignCourier(courier(), NOW)).toThrow(BusinessRuleViolationError)
        order.advanceTo(OrderStatus.ACCEPTED)
        order.assignCourier(courier(), NOW)
        expect(order.courierName).toBe("Jasur")
        order.assignCourier(courier("biz-1", "courier-2"), NOW)
        expect(order.isAssignedTo("courier-2")).toBe(true)
    })

    it("rejects couriers of another shop or who left", () => {
        const order = readyOrder()
        expect(() => order.assignCourier(courier("biz-2"), NOW)).toThrow(BusinessRuleViolationError)
        const gone = courier()
        gone.deactivate(NOW)
        expect(() => order.assignCourier(gone, NOW)).toThrow(BusinessRuleViolationError)
        const offShift = courier()
        offShift.profile.endShift(NOW)
        expect(() => order.assignCourier(offShift, NOW)).toThrow(/cannot take an order/)
    })

    it("no reassignment once the order is on the road", () => {
        const order = readyOrder()
        order.assignCourier(courier(), NOW)
        order.advanceTo(OrderStatus.PICKED_UP, { role: "courier", courierId: "courier-1" })
        expect(() => order.assignCourier(courier("biz-1", "courier-2"), NOW)).toThrow(
            BusinessRuleViolationError,
        )
    })

    it("the assigned courier moves only the delivery part", () => {
        const order = placeOrder()
        order.advanceTo(OrderStatus.ACCEPTED)
        order.assignCourier(courier(), NOW)
        const me = { role: "courier", courierId: "courier-1" } as const
        expect(() => order.advanceTo(OrderStatus.PREPARING, me)).toThrow(ForbiddenError)
        order.advanceTo(OrderStatus.PREPARING)
        order.advanceTo(OrderStatus.READY)
        order.advanceTo(OrderStatus.PICKED_UP, me)
        order.advanceTo(OrderStatus.DELIVERED, me, PaidWith.CASH)
        expect(order.status).toBe(OrderStatus.DELIVERED)
        // The courier took the cash.
        expect(order.payment.cashCourierId).toBe("courier-1")
    })

    it("another courier cannot touch the order", () => {
        const order = readyOrder()
        order.assignCourier(courier(), NOW)
        expect(() =>
            order.advanceTo(OrderStatus.PICKED_UP, { role: "courier", courierId: "courier-2" }),
        ).toThrow(ForbiddenError)
    })
})
