import { describe, expect, it } from "vitest"

import { Courier } from "../../../domain/entities/courier.js"
import { Order } from "../../../domain/entities/order.js"
import { OrderItem } from "../../../domain/entities/order-item.js"
import { OrderChannel } from "../../../domain/enums/order-channel.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"
import { PaymentMethod } from "../../../domain/enums/payment.js"
import { SendWay, isSendWay } from "../../../domain/enums/send-way.js"
import { Unit } from "../../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { MAX_DELIVERY_NOTES } from "../../../domain/value-objects/delivery-note.js"
import { Money } from "../../../domain/value-objects/money.js"
import { makeCourier, withReceipt } from "../../fixtures.js"

import type { PlaceOrderProps } from "../../../domain/entities/order.js"

const NOW = new Date()
const ME = { role: "courier", courierId: "courier-1" } as const

function place(extra: Partial<PlaceOrderProps> = {}): Order {
    return Order.place({
        id: "order-1",
        businessId: "biz-1",
        customerId: "cust-1",
        number: 7,
        channel: OrderChannel.SHOP_BOT,
        commissionBps: 0,
        items: [
            OrderItem.create({
                productId: "toy-1",
                name: "Mantiqiy kubik",
                unit: Unit.PIECE,
                category: "logic_games",
                unitPrice: Money.of(90_000),
                quantity: 1,
            }),
        ],
        deliveryFee: Money.of(10_000),
        address: "Qarshi, Navoiy 12",
        customerName: "Aziz",
        ...extra,
    })
}

function dispatcher(id = "courier-1"): Courier {
    const courier = makeCourier({ id, now: NOW })
    courier.setDispatcher(true, NOW)
    return courier
}

/** Paid, handed to the shop's dispatcher, packed by the owner. */
function readyWithDispatcher(): Order {
    const order = place()
    withReceipt(order).confirmPaymentAndStart()
    order.assignCourier(dispatcher(), NOW)
    order.advanceTo(OrderStatus.READY)
    return order
}

describe("A dispatcher courier", () => {
    it("the owner switches the shop's own courier to a dispatcher and back", () => {
        const courier = makeCourier({ now: NOW })
        expect(courier.isDispatcher).toBe(false)
        courier.setDispatcher(true, NOW)
        expect(courier.isDispatcher).toBe(true)
        courier.setDispatcher(false, NOW)
        expect(courier.isDispatcher).toBe(false)
    })

    it("a network courier of another shop is never its dispatcher", () => {
        const visitor = Courier.forNetwork({
            id: "link-9",
            businessId: "biz-1",
            profile: makeCourier({ now: NOW }).profile,
            now: NOW,
        })
        expect(() => visitor.setDispatcher(true, NOW)).toThrow(
            expect.objectContaining({ rule: "NOT_OWN_COURIER" }),
        )
    })

    it("knows its ways", () => {
        expect(isSendWay("post")).toBe(true)
        expect(isSendWay("pigeon")).toBe(false)
    })
})

describe("An order with the shop's dispatcher", () => {
    it("keeps that its courier is a dispatcher, like the name and the phone", () => {
        const order = place()
        withReceipt(order).confirmPaymentAndStart()
        order.assignCourier(dispatcher(), NOW)
        expect(order.isWithDispatcher()).toBe(true)
        // Given to a rider instead: a plain courier order again.
        order.assignCourier(makeCourier({ id: "courier-2", now: NOW }), NOW)
        expect(order.isWithDispatcher()).toBe(false)
    })

    it("a cash order never goes to a dispatcher: no money passes through a stranger", () => {
        const order = place({ paymentMethod: PaymentMethod.CASH })
        order.acceptAndStart()
        expect(() => order.assignCourier(dispatcher(), NOW)).toThrow(
            expect.objectContaining({ rule: "CASH_NOT_FOR_DISPATCHER" }),
        )
        expect(order.courierId).toBeUndefined()
    })

    it("«Jo'natdim» says how it went; a bare «picked up» is refused to everyone", () => {
        const order = readyWithDispatcher()
        expect(() => order.advanceTo(OrderStatus.PICKED_UP, ME)).toThrow(
            expect.objectContaining({ rule: "SEND_WAY_REQUIRED" }),
        )
        expect(() => order.advanceTo(OrderStatus.PICKED_UP)).toThrow(BusinessRuleViolationError)
        order.send("courier-1", SendWay.POST, "  Trek: UZ123456  ", NOW)
        expect(order.status).toBe(OrderStatus.PICKED_UP)
        expect(order.sentVia).toBe(SendWay.POST)
        expect(order.deliveryNotes).toEqual([{ at: NOW, text: "Trek: UZ123456" }])
        order.advanceTo(OrderStatus.DELIVERED, ME)
        expect(order.status).toBe(OrderStatus.DELIVERED)
    })

    it("a taxi or the dispatcher's own trip may go without a note; «Boshqa» needs one", () => {
        const taxi = readyWithDispatcher()
        taxi.send("courier-1", SendWay.TAXI, "   ", NOW)
        expect(taxi.deliveryNotes).toEqual([])
        const other = readyWithDispatcher()
        expect(() => other.send("courier-1", SendWay.OTHER, undefined, NOW)).toThrow(
            ValidationError,
        )
        expect(other.status).toBe(OrderStatus.READY)
        other.send("courier-1", SendWay.OTHER, "Qo'shni olib ketdi", NOW)
        expect(other.sentVia).toBe(SendWay.OTHER)
    })

    it("only after the owner packed it, and only by its own dispatcher", () => {
        const order = place()
        withReceipt(order).confirmPaymentAndStart()
        order.assignCourier(dispatcher(), NOW)
        expect(() => order.send("courier-1", SendWay.TAXI, undefined, NOW)).toThrow()
        expect(order.sentVia).toBeUndefined()
        order.advanceTo(OrderStatus.READY)
        expect(() => order.send("courier-2", SendWay.TAXI, undefined, NOW)).toThrow(ForbiddenError)
        expect(order.status).toBe(OrderStatus.READY)
    })

    it("a rider's order has no «Jo'natdim» and no notes", () => {
        const order = place()
        withReceipt(order).confirmPaymentAndStart()
        order.assignCourier(makeCourier({ now: NOW }), NOW)
        order.advanceTo(OrderStatus.READY)
        expect(() => order.send("courier-1", SendWay.TAXI, undefined, NOW)).toThrow(
            expect.objectContaining({ rule: "NOT_A_DISPATCHER_ORDER" }),
        )
        expect(() => order.addDeliveryNote("courier-1", "Salom", NOW)).toThrow(
            expect.objectContaining({ rule: "NOT_A_DISPATCHER_ORDER" }),
        )
        order.advanceTo(OrderStatus.PICKED_UP, ME)
        expect(order.status).toBe(OrderStatus.PICKED_UP)
    })

    it("the dispatcher writes from the moment they have it until it is delivered", () => {
        const order = place()
        withReceipt(order).confirmPaymentAndStart()
        order.assignCourier(dispatcher(), NOW)
        order.addDeliveryNote("courier-1", "Taksi chaqirildi, 20 daqiqada", NOW)
        expect(() => order.addDeliveryNote("courier-2", "Men ham", NOW)).toThrow(ForbiddenError)
        expect(() => order.addDeliveryNote("courier-1", "   ", NOW)).toThrow(ValidationError)
        order.advanceTo(OrderStatus.READY)
        order.send("courier-1", SendWay.TAXI, "01 A 123 BC, yo'l haqi 30 000", NOW)
        order.addDeliveryNote("courier-1", "Haydovchi 10 daqiqada yetadi", NOW)
        expect(order.deliveryNotes.map((note) => note.text)).toEqual([
            "Taksi chaqirildi, 20 daqiqada",
            "01 A 123 BC, yo'l haqi 30 000",
            "Haydovchi 10 daqiqada yetadi",
        ])
        order.advanceTo(OrderStatus.DELIVERED, ME)
        expect(() => order.addDeliveryNote("courier-1", "Rahmat", NOW)).toThrow(
            expect.objectContaining({ rule: "NOTES_CLOSED" }),
        )
    })

    it("keeps at most twenty notes", () => {
        const order = readyWithDispatcher()
        for (let n = 1; n <= MAX_DELIVERY_NOTES; n++) {
            order.addDeliveryNote("courier-1", `Izoh ${n}`, NOW)
        }
        expect(() => order.addDeliveryNote("courier-1", "Yana", NOW)).toThrow(
            expect.objectContaining({ rule: "TOO_MANY_NOTES" }),
        )
        expect(() => order.send("courier-1", SendWay.POST, "Trek", NOW)).toThrow(
            expect.objectContaining({ rule: "TOO_MANY_NOTES" }),
        )
        // Without a note it still goes on.
        order.send("courier-1", SendWay.POST, undefined, NOW)
        expect(order.deliveryNotes).toHaveLength(MAX_DELIVERY_NOTES)
    })

    it("the owner may still mark it delivered when the dispatcher went silent", () => {
        const order = readyWithDispatcher()
        order.send("courier-1", SendWay.POST, undefined, NOW)
        order.advanceTo(OrderStatus.DELIVERED)
        expect(order.status).toBe(OrderStatus.DELIVERED)
    })

    it("never joins a trip: each order goes its own way", () => {
        const order = readyWithDispatcher()
        expect(() => order.joinTrip("trip-1", 1)).toThrow(BusinessRuleViolationError)
    })

    it("comes back from storage with its dispatcher, way and notes", () => {
        const order = readyWithDispatcher()
        const notes = [{ at: NOW, text: "Trek" }]
        const copy = Order.reconstitute({
            id: order.id,
            businessId: order.businessId,
            customerId: order.customerId,
            number: order.number,
            channel: order.channel,
            items: order.items,
            subtotal: order.subtotal,
            deliveryFee: order.deliveryFee,
            depositTotal: order.depositTotal,
            bottlesReturned: 0,
            total: order.total,
            commissionBps: 0,
            commission: Money.zero(),
            payment: order.payment,
            status: OrderStatus.PICKED_UP,
            courierId: "courier-1",
            courierName: "Jasur",
            dispatcher: true,
            sentVia: SendWay.POST,
            deliveryNotes: notes,
            customerPaysCarrier: true,
            address: order.address,
            customerName: order.customerName,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        })
        expect(copy.sentVia).toBe(SendWay.POST)
        expect(copy.deliveryNotes).toEqual(notes)
        expect(copy.deliveryNotes).not.toBe(notes)
        expect(copy.isWithDispatcher()).toBe(true)
        expect(copy.customerPaysCarrier).toBe(true)
    })
})

describe("The courier choice before the order goes on", () => {
    it("nobody on it: «Tayyor» and «Jo'natish» wait in a shop with couriers", () => {
        const order = place()
        withReceipt(order).confirmPaymentAndStart()
        expect(order.needsCourierChoice()).toBe(true)
        expect(() => order.assertCourierChosen(OrderStatus.READY)).toThrow(
            expect.objectContaining({ rule: "COURIER_NOT_CHOSEN" }),
        )
        expect(() => order.assertCourierChosen(OrderStatus.PICKED_UP)).toThrow(
            BusinessRuleViolationError,
        )
        // Accepting and cancelling never wait.
        expect(() => order.assertCourierChosen(OrderStatus.PREPARING)).not.toThrow()
        expect(() => order.assertCourierChosen(OrderStatus.CANCELLED)).not.toThrow()
        order.assignCourier(makeCourier({ now: NOW }), NOW)
        expect(order.needsCourierChoice()).toBe(false)
        expect(() => order.assertCourierChosen(OrderStatus.READY)).not.toThrow()
    })

    it("«O'zim yetkazaman»: the owner takes it, a courier who had it is let go", () => {
        const order = place()
        withReceipt(order).confirmPaymentAndStart()
        order.assignCourier(dispatcher(), NOW)
        order.deliverMyself()
        expect(order.ownerDelivers).toBe(true)
        expect(order.courierId).toBeUndefined()
        expect(order.courierName).toBeUndefined()
        expect(order.isWithDispatcher()).toBe(false)
        expect(order.needsCourierChoice()).toBe(false)
        order.advanceTo(OrderStatus.READY)
        order.advanceTo(OrderStatus.PICKED_UP)
        order.advanceTo(OrderStatus.DELIVERED)
        expect(order.status).toBe(OrderStatus.DELIVERED)
        expect(() => order.deliverMyself()).toThrow(BusinessRuleViolationError)
    })

    it("a courier after «O'zim yetkazaman» takes it over again", () => {
        const order = place()
        withReceipt(order).confirmPaymentAndStart()
        order.deliverMyself()
        order.assignCourier(makeCourier({ now: NOW }), NOW)
        expect(order.ownerDelivers).toBe(false)
        expect(order.isAssignedTo("courier-1")).toBe(true)
    })

    it("the network looking for a courier counts as chosen", () => {
        const order = place()
        withReceipt(order).confirmPaymentAndStart()
        order.deliverMyself()
        order.requestNetwork(NOW)
        expect(order.ownerDelivers).toBe(false)
        expect(order.needsCourierChoice()).toBe(false)
    })
})

describe("A delivery the customer pays to the carrier", () => {
    it("adds nothing to the total and keeps the snapshot", () => {
        const order = place({ customerPaysCarrier: true })
        expect(order.customerPaysCarrier).toBe(true)
        expect(order.deliveryFee.amount).toBe(0)
        expect(order.total.amount).toBe(90_000)
        expect(place().customerPaysCarrier).toBe(false)
        expect(place().total.amount).toBe(100_000)
    })

    it("never goes to the district network: a network courier carries no money", () => {
        const order = place({ customerPaysCarrier: true })
        withReceipt(order).confirmPaymentAndStart()
        expect(() => order.requestNetwork(NOW)).toThrow(
            expect.objectContaining({ rule: "CARRIER_NOT_FOR_NETWORK" }),
        )
    })
})
