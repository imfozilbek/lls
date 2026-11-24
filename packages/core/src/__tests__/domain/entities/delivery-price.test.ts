import { describe, expect, it } from "vitest"

import { Order } from "../../../domain/entities/order.js"
import { OrderItem } from "../../../domain/entities/order-item.js"
import { BusinessType } from "../../../domain/enums/business-type.js"
import { DeliveryPrice, isDeliveryPriceChoice } from "../../../domain/enums/delivery-price.js"
import { OrderChannel } from "../../../domain/enums/order-channel.js"
import { Unit } from "../../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { Location } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { makeBusiness } from "../../fixtures.js"

describe("delivery price (owner's decision, November 2026)", () => {
    it("a new shop with no fee has not chosen: nothing is promised, never «bepul»", () => {
        const shop = makeBusiness({ delivery: { fee: Money.zero() } })
        expect(shop.deliveryPrice).toBe(DeliveryPrice.UNSET)
        expect(shop.deliveryFeeFor(Money.of(50_000)).isZero()).toBe(true)
        expect(shop.deliversFreeFor(Money.of(50_000))).toBe(false)
    })

    it("a fee is a choice by itself, and its «… dan bepul» promises free delivery", () => {
        const shop = makeBusiness({
            delivery: { fee: Money.of(10_000), freeFrom: Money.of(100_000) },
        })
        expect(shop.deliveryPrice).toBe(DeliveryPrice.FEE)
        expect(shop.delivery.priceChosen).toBe(true)
        expect(shop.deliveryFeeFor(Money.of(50_000)).amount).toBe(10_000)
        expect(shop.deliversFreeFor(Money.of(50_000))).toBe(false)
        expect(shop.deliveryFeeFor(Money.of(100_000)).isZero()).toBe(true)
        expect(shop.deliversFreeFor(Money.of(100_000))).toBe(true)
    })

    it("«Bepul» clears the fee and its threshold, and stays chosen on a later save", () => {
        const shop = makeBusiness({ delivery: { fee: Money.zero() } })
        shop.updateDelivery(
            { fee: Money.of(7_000), freeFrom: Money.of(90_000), minOrder: Money.of(20_000) },
            DeliveryPrice.FREE,
        )
        expect(shop.deliveryPrice).toBe(DeliveryPrice.FREE)
        expect(shop.delivery.fee.isZero()).toBe(true)
        expect(shop.delivery.freeFrom).toBeUndefined()
        expect(shop.delivery.minOrder?.amount).toBe(20_000)
        expect(shop.deliversFreeFor(Money.of(1_000))).toBe(true)
        // A save of other settings sends the delivery fields too, without a choice.
        shop.updateDelivery({ fee: Money.zero(), radiusMeters: 3_000 })
        expect(shop.deliveryPrice).toBe(DeliveryPrice.FREE)
    })

    it("«Narxi bor» needs a price above zero", () => {
        const shop = makeBusiness({ delivery: { fee: Money.zero() } })
        expect(() => shop.updateDelivery({ fee: Money.zero() }, DeliveryPrice.FEE)).toThrow(
            ValidationError,
        )
        expect(shop.deliveryPrice).toBe(DeliveryPrice.UNSET)
        shop.updateDelivery({ fee: Money.of(12_000) }, DeliveryPrice.FEE)
        expect(shop.deliveryPrice).toBe(DeliveryPrice.FEE)
    })

    it("«Narxi keyin aytiladi»: the customer pays the carrier, the order adds nothing", () => {
        const shop = makeBusiness({ delivery: { fee: Money.of(10_000) } })
        shop.updateDelivery(
            { fee: Money.of(10_000), freeFrom: Money.of(80_000) },
            DeliveryPrice.LATER,
        )
        expect(shop.deliveryPrice).toBe(DeliveryPrice.LATER)
        expect(shop.delivery.customerPaysCarrier).toBe(true)
        expect(shop.delivery.freeFrom).toBeUndefined()
        expect(shop.deliveryFeeFor(Money.of(10_000)).isZero()).toBe(true)
        expect(shop.deliversFreeFor(Money.of(10_000))).toBe(false)
        // Back to a price of its own.
        shop.updateDelivery({ fee: Money.of(9_000) }, DeliveryPrice.FEE)
        expect(shop.delivery.customerPaysCarrier).toBe(false)
        expect(shop.deliveryFeeFor(Money.of(10_000)).amount).toBe(9_000)
    })

    it("a service delivers nothing: no price, no fee, nothing free", () => {
        const shop = makeBusiness({
            type: BusinessType.SERVICE,
            delivery: { fee: Money.of(10_000), freeFrom: Money.of(150_000) },
        })
        expect(shop.deliveryPrice).toBe(DeliveryPrice.NONE)
        expect(shop.deliveryFeeFor(Money.of(10_000)).isZero()).toBe(true)
        expect(shop.deliversFreeFor(Money.of(200_000))).toBe(false)
    })

    it("only the owner's three choices are choices", () => {
        expect(isDeliveryPriceChoice("free")).toBe(true)
        expect(isDeliveryPriceChoice("later")).toBe(true)
        expect(isDeliveryPriceChoice("unset")).toBe(false)
        expect(isDeliveryPriceChoice("none")).toBe(false)
    })
})

function placeOrder(input: {
    deliveryFee: number
    deliveryFree?: boolean
    carrier?: boolean
}): Order {
    return Order.place({
        id: "order-1",
        businessId: "biz-1",
        customerId: "cust-1",
        number: 1,
        channel: OrderChannel.SHOP_BOT,
        items: [
            OrderItem.create({
                productId: "toy-1",
                name: "Mantiqiy kubik",
                unit: Unit.PIECE,
                category: "logic_games",
                unitPrice: Money.of(45_000),
                quantity: 1,
            }),
        ],
        deliveryFee: Money.of(input.deliveryFee),
        commissionBps: 0,
        address: "Markaz",
        customerName: "Aziz",
        deliveryFree: input.deliveryFree,
        customerPaysCarrier: input.carrier,
    })
}

describe("the order keeps what was promised about delivery", () => {
    it("«bepul» only when the shop promised it", () => {
        expect(placeOrder({ deliveryFee: 0, deliveryFree: true }).deliveryFree).toBe(true)
        expect(placeOrder({ deliveryFee: 0 }).deliveryFree).toBe(false)
        expect(placeOrder({ deliveryFee: 10_000, deliveryFree: true }).deliveryFree).toBe(false)
        expect(placeOrder({ deliveryFee: 0, deliveryFree: true, carrier: true }).deliveryFree).toBe(
            false,
        )
    })

    it("«O'zbekiston bo'ylab yetkazamiz»: only with the carrier, and then no radius holds", () => {
        const shop = makeBusiness({ delivery: { fee: Money.zero(), radiusMeters: 3_000 } })
        shop.updateProfile({ location: Location.create(41.3111, 69.2797) })
        const far = Location.create(39.65, 66.96)
        // A shop that charges a fee has its own couriers: never the country.
        shop.updateDelivery({ fee: Money.of(5_000) }, DeliveryPrice.FEE)
        expect(() => shop.updateDelivery({ fee: Money.of(5_000), nationwide: true })).toThrow(
            BusinessRuleViolationError,
        )
        shop.updateDelivery(
            { fee: Money.zero(), radiusMeters: 3_000, nationwide: true },
            DeliveryPrice.LATER,
        )
        expect(shop.delivery.nationwide).toBe(true)
        expect(() => shop.assertDeliversTo(far)).not.toThrow()
        // Another price switches it off by itself, and the radius holds again.
        shop.updateDelivery(
            { fee: Money.zero(), radiusMeters: 3_000, nationwide: true },
            DeliveryPrice.FREE,
        )
        expect(shop.delivery.nationwide).toBe(false)
        expect(() => shop.assertDeliversTo(far)).toThrow(/delivery zone/)
    })
})
