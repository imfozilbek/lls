import { describe, expect, it } from "vitest"

import { CourierProfile } from "../../../domain/entities/courier-profile.js"
import { Courier } from "../../../domain/entities/courier.js"
import {
    DEFAULT_NETWORK_WAIT_MINUTES,
    District,
    districtOf,
} from "../../../domain/entities/district.js"
import { Order, networkUnavailableReason } from "../../../domain/entities/order.js"
import { OrderItem } from "../../../domain/entities/order-item.js"
import { CourierStatus } from "../../../domain/enums/courier-status.js"
import { DeliveryFeeRecipient } from "../../../domain/enums/delivery-fee.js"
import { OrderChannel } from "../../../domain/enums/order-channel.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"
import { Unit } from "../../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { Location } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { makeBusiness, makeCourier } from "../../fixtures.js"

const NOW = new Date()
const GULISTAN = Location.create(40.4897, 68.7842)
/** Yangiyer: about 25 km from Gulistan. */
const YANGIYER = Location.create(40.275, 68.8225)
/** Tashkent: about 100 km away. */
const TASHKENT = Location.create(41.2995, 69.2401)

function district(name = "Guliston", center = GULISTAN, radiusMeters = 30_000): District {
    return District.create({ id: `d-${name}`, name, center, radiusMeters, now: NOW })
}

function placed(): Order {
    return Order.place({
        id: "order-1",
        businessId: "biz-1",
        customerId: "cust-1",
        number: 1,
        channel: OrderChannel.SHOP_BOT,
        commissionBps: 0,
        items: [
            OrderItem.create({
                productId: "prod-1",
                name: "Osh",
                unit: Unit.PORTION,
                category: "meals",
                unitPrice: Money.of(35_000),
                quantity: 2,
            }),
        ],
        deliveryFee: Money.of(10_000),
        address: "Navoiy 12",
        customerName: "Aziz",
    })
}

function accepted(): Order {
    const order = placed()
    order.confirmPaymentAndAccept()
    return order
}

/** Someone of another shop, in the network and on shift, now holding a network link here. */
function networkLink(inNetwork = true, onShift = true): Courier {
    const profile = CourierProfile.create({
        telegramId: TelegramId.create(7007),
        name: "Bobur",
        now: NOW,
    })
    if (inNetwork) {
        profile.setInNetwork(true, NOW)
    }
    if (onShift) {
        profile.startShift(NOW)
    }
    return Courier.forNetwork({ id: "net-1", businessId: "biz-1", profile, now: NOW })
}

describe("District", () => {
    it("contains what is inside its radius; the closest center wins", () => {
        const guliston = district()
        expect(guliston.contains(YANGIYER)).toBe(true)
        expect(guliston.contains(TASHKENT)).toBe(false)
        expect(guliston.waitMinutes).toBe(DEFAULT_NETWORK_WAIT_MINUTES)
        const yangiyer = district("Yangiyer", YANGIYER, 30_000)
        expect(districtOf([guliston, yangiyer], YANGIYER)?.name).toBe("Yangiyer")
        expect(districtOf([guliston, yangiyer], GULISTAN)?.name).toBe("Guliston")
        expect(districtOf([guliston], TASHKENT)).toBeUndefined()
        expect(districtOf([guliston], undefined)).toBeUndefined()
    })

    it("moves, changes its waiting time, and rejects nonsense", () => {
        const guliston = district()
        guliston.moveTo(TASHKENT, 20_000, NOW)
        expect(guliston.contains(GULISTAN)).toBe(false)
        guliston.setWaitMinutes(15, NOW)
        const requested = new Date("2026-10-01T10:00:00Z")
        expect(guliston.overdueAt(requested).toISOString()).toBe("2026-10-01T10:15:00.000Z")
        expect(() => guliston.setWaitMinutes(0, NOW)).toThrow(ValidationError)
        expect(() => district("Tiny", GULISTAN, 10)).toThrow(ValidationError)
        expect(() => district(" ", GULISTAN)).toThrow(ValidationError)
        const copy = District.reconstitute({
            id: guliston.id,
            name: guliston.name,
            center: guliston.center,
            radiusMeters: guliston.radiusMeters,
            waitMinutes: guliston.waitMinutes,
            createdAt: guliston.createdAt,
            updatedAt: guliston.updatedAt,
        })
        expect(copy.radiusMeters).toBe(20_000)
    })
})

describe("network consent and shop settings", () => {
    it("the courier joins and leaves the network; the offer comes once", () => {
        const profile = CourierProfile.create({
            telegramId: TelegramId.create(7007),
            name: "Bobur",
            now: NOW,
        })
        expect(profile.inNetwork).toBe(false)
        expect(profile.offerNetwork(NOW)).toBe(true)
        expect(profile.offerNetwork(NOW)).toBe(false)
        profile.setInNetwork(true, NOW)
        expect(profile.inNetwork).toBe(true)
        profile.setInNetwork(false, NOW)
        expect(profile.inNetwork).toBe(false)
        expect(profile.networkOfferedAt).toEqual(NOW)
    })

    it("a shop sends to the network unless the owner switched it off; its district is set", () => {
        const shop = makeBusiness()
        expect(shop.networkDelivery).toBe(true)
        expect(shop.districtId).toBeUndefined()
        shop.setNetworkDelivery(false)
        shop.setDistrict("d-Guliston")
        expect(shop.networkDelivery).toBe(false)
        expect(shop.districtId).toBe("d-Guliston")
    })

    it("a network link moves its orders of that shop but is not the shop's courier", () => {
        const link = networkLink()
        expect(link.status).toBe(CourierStatus.NETWORK)
        expect(link.isNetwork).toBe(true)
        expect(link.deliversFor("biz-1")).toBe(true)
        expect(link.deliversFor("biz-2")).toBe(false)
        expect(link.worksFor("biz-1")).toBe(false)
        expect(link.unavailableReason(NOW)).toBe("not_approved")
        // A new invite of that shop turns the person into a candidate of its own.
        link.rejoin(NOW)
        expect(link.isPending).toBe(true)
    })
})

describe("Order and the district network", () => {
    it("an accepted order without a courier goes to the network; the first «Беру» wins", () => {
        const order = accepted()
        expect(order.isWaitingForNetwork()).toBe(false)
        order.requestNetwork(NOW)
        order.requestNetwork(new Date(NOW.getTime() + 1000))
        expect(order.networkRequestedAt).toEqual(NOW)
        expect(order.isWaitingForNetwork()).toBe(true)
        expect(order.isViaNetwork()).toBe(false)

        order.claimByNetwork(networkLink(), NOW, false)
        expect(order.courierId).toBe("net-1")
        expect(order.courierName).toBe("Bobur")
        expect(order.isViaNetwork()).toBe(true)
        expect(order.deliveryFeeTo).toBe(DeliveryFeeRecipient.BUSINESS)
        expect(() => order.claimByNetwork(networkLink(), NOW, false)).toThrow(
            BusinessRuleViolationError,
        )
    })

    it("only before pickup and without a courier", () => {
        const pending = placed()
        expect(() => pending.requestNetwork(NOW)).toThrow(BusinessRuleViolationError)
        const assigned = accepted()
        assigned.assignCourier(makeCourier({ now: NOW }), NOW)
        expect(() => assigned.requestNetwork(NOW)).toThrow(BusinessRuleViolationError)
        const notAsked = accepted()
        expect(() => notAsked.claimByNetwork(networkLink(), NOW, false)).toThrow(
            BusinessRuleViolationError,
        )
    })

    it("the shop's own courier takes it back from the network", () => {
        const order = accepted()
        order.requestNetwork(NOW)
        order.markNetworkAlerted(NOW)
        expect(order.networkAlertedAt).toEqual(NOW)
        order.assignCourier(makeCourier({ now: NOW }), NOW)
        expect(order.isWaitingForNetwork()).toBe(false)
        expect(order.isViaNetwork()).toBe(false)
        expect(order.networkAlertedAt).toBeUndefined()
    })

    it("a link of another shop never takes it", () => {
        const order = accepted()
        order.requestNetwork(NOW)
        const other = Courier.forNetwork({
            id: "net-2",
            businessId: "biz-2",
            profile: networkLink().profile,
            now: NOW,
        })
        expect(() => order.claimByNetwork(other, NOW, false)).toThrow(BusinessRuleViolationError)
    })

    it("says why someone cannot take a network order", () => {
        expect(networkUnavailableReason(networkLink(), NOW, false)).toBeNull()
        expect(networkUnavailableReason(networkLink(false), NOW, false)).toBe("not_in_network")
        expect(networkUnavailableReason(networkLink(true, false), NOW, false)).toBe("not_on_shift")
        expect(networkUnavailableReason(networkLink(), NOW, true)).toBe("busy")
        const pending = makeCourier({ now: NOW })
        pending.deactivate(NOW)
        expect(networkUnavailableReason(pending, NOW, false)).toBe("not_approved")

        const order = accepted()
        order.requestNetwork(NOW)
        expect(() => order.claimByNetwork(networkLink(), NOW, true)).toThrow(
            expect.objectContaining({ rule: "COURIER_NOT_AVAILABLE" }),
        )
    })
})
