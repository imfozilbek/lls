import { describe, expect, it } from "vitest"

import { Business } from "../../../domain/entities/business.js"
import { BusinessStatus } from "../../../domain/enums/business-status.js"
import { Feature } from "../../../domain/enums/feature.js"
import { OrderChannel } from "../../../domain/enums/order-channel.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { BrandColor } from "../../../domain/value-objects/brand-color.js"
import { Location } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { WorkingHours } from "../../../domain/value-objects/working-hours.js"
import { NOON_MONDAY_UZ, OWNER_TG, STRANGER_TG, makeBusiness } from "../../fixtures.js"

describe("Business", () => {
    it("registers as pending with safe defaults", () => {
        const business = makeBusiness({ active: false })
        expect(business.status).toBe(BusinessStatus.PENDING)
        expect(business.brandColor.hex).toBe("#15803d")
        expect(business.workingHours.toJSON()).toBeNull()
        expect(business.acceptingOrders).toBe(true)
        expect(business.features).toEqual([Feature.REORDER, Feature.STOP_LIST])
        expect(business.bottleDeposit.amount).toBe(0)
        expect(business.marketplace).toBeUndefined()
        expect(business.bot).toEqual({ id: 777, username: "osh_markaz_bot" })
        expect(business.slug.value).toBe("osh-markaz")
    })

    it("knows its owner", () => {
        const business = makeBusiness()
        expect(business.isOwnedBy(OWNER_TG)).toBe(true)
        expect(business.isOwnedBy(STRANGER_TG)).toBe(false)
    })

    it("approve activates once; disable deactivates", () => {
        const business = makeBusiness({ active: false })
        business.approve()
        expect(business.isActive()).toBe(true)
        expect(() => business.approve()).toThrow(BusinessRuleViolationError)
        business.disable()
        expect(business.status).toBe(BusinessStatus.DISABLED)
        business.approve()
        expect(business.isActive()).toBe(true)
    })

    it("accepts orders only when active, accepting and open", () => {
        const pending = makeBusiness({ active: false })
        expect(() => pending.assertCanAcceptOrders(NOON_MONDAY_UZ)).toThrow(/not active/)

        const paused = makeBusiness()
        paused.setAcceptingOrders(false)
        expect(() => paused.assertCanAcceptOrders(NOON_MONDAY_UZ)).toThrow(/not accepting/)
        expect(paused.isOpenAt(NOON_MONDAY_UZ)).toBe(false)

        const noCard = makeBusiness({ card: false })
        expect(() => noCard.assertCanAcceptOrders(NOON_MONDAY_UZ)).toThrow(/no card/)
        expect(noCard.isOpenAt(NOON_MONDAY_UZ)).toBe(false)

        const closed = makeBusiness()
        closed.setWorkingHours(WorkingHours.create({ tue: { open: "09:00", close: "18:00" } }))
        expect(() => closed.assertCanAcceptOrders(NOON_MONDAY_UZ)).toThrow(/closed/)

        const open = makeBusiness()
        expect(() => open.assertCanAcceptOrders(NOON_MONDAY_UZ)).not.toThrow()
        expect(open.isOpenAt(NOON_MONDAY_UZ)).toBe(true)
    })

    it("delivery fee is free above the threshold", () => {
        const business = makeBusiness({
            delivery: { fee: Money.of(10_000), freeFrom: Money.of(100_000) },
        })
        expect(business.deliveryFeeFor(Money.of(99_999)).amount).toBe(10_000)
        expect(business.deliveryFeeFor(Money.of(100_000)).amount).toBe(0)
    })

    it("enforces the minimum order", () => {
        const business = makeBusiness({
            delivery: { fee: Money.of(5_000), minOrder: Money.of(50_000) },
        })
        expect(() => business.assertMinOrder(Money.of(49_000))).toThrow(BusinessRuleViolationError)
        expect(() => business.assertMinOrder(Money.of(50_000))).not.toThrow()
        expect(() => makeBusiness().assertMinOrder(Money.of(1))).not.toThrow()
    })

    it("checks the delivery radius only when everything is known", () => {
        const business = makeBusiness({ delivery: { fee: Money.of(0), radiusMeters: 3_000 } })
        const near = Location.create(41.3111, 69.2917)
        const far = Location.create(41.4, 69.5)
        expect(() => business.assertDeliversTo(far)).not.toThrow()
        business.updateProfile({ location: Location.create(41.3111, 69.2797) })
        expect(() => business.assertDeliversTo(near)).not.toThrow()
        expect(() => business.assertDeliversTo(far)).toThrow(/delivery zone/)
        expect(() => business.assertDeliversTo(undefined)).not.toThrow()
    })

    it("updates profile fields and can clear optional ones", () => {
        const business = makeBusiness()
        business.updateProfile({
            name: "  Osh Markaz 2 ",
            brandColor: BrandColor.create("#ff0000"),
            logoKey: "logos/1.webp",
            address: "Mustaqillik 5",
        })
        expect(business.name).toBe("Osh Markaz 2")
        expect(business.brandColor.hex).toBe("#ff0000")
        expect(business.logoKey).toBe("logos/1.webp")
        expect(business.address).toBe("Mustaqillik 5")
        business.updateProfile({ logoKey: null, address: null, location: null })
        expect(business.logoKey).toBeUndefined()
        expect(business.address).toBeUndefined()
        expect(business.location).toBeUndefined()
        expect(() => business.updateProfile({ name: "" })).toThrow(ValidationError)
    })

    it("updates delivery, features and validates radius", () => {
        const business = makeBusiness()
        business.updateDelivery({ fee: Money.of(7_000), radiusMeters: 5_000 })
        expect(business.delivery.fee.amount).toBe(7_000)
        expect(() => business.updateDelivery({ fee: Money.of(0), radiusMeters: 0 })).toThrow(
            ValidationError,
        )
        business.setFeatures([Feature.REORDER, Feature.REORDER])
        expect(business.features).toEqual([Feature.REORDER])
        expect(business.hasFeature(Feature.REORDER)).toBe(true)
    })

    it("charges a deposit only for kept bottles and only with the feature on", () => {
        const water = makeBusiness()
        water.setBottleDeposit(Money.of(30_000))
        expect(water.depositFor(2, 0).amount).toBe(0)
        water.setFeatures([Feature.BOTTLE_DEPOSIT])
        expect(water.depositFor(2, 0).amount).toBe(60_000)
        expect(water.depositFor(2, 1).amount).toBe(30_000)
        expect(water.depositFor(2, 5).amount).toBe(0)
        expect(() => water.setBottleDeposit(Money.of(2_000_000))).toThrow(ValidationError)
    })

    it("takes a commission only on marketplace sales, with a signed deal", () => {
        const shop = makeBusiness()
        expect(shop.commissionBpsFor(OrderChannel.SHOP_BOT)).toBe(0)
        expect(() => shop.commissionBpsFor(OrderChannel.MARKETPLACE)).toThrow(
            BusinessRuleViolationError,
        )
        shop.joinMarketplace(800, NOON_MONDAY_UZ)
        expect(shop.commissionBpsFor(OrderChannel.MARKETPLACE)).toBe(800)
        expect(shop.commissionBpsFor(OrderChannel.SHOP_BOT)).toBe(0)
        expect(shop.marketplace?.joinedAt).toBe(NOON_MONDAY_UZ)
        expect(() => shop.joinMarketplace(6_000, NOON_MONDAY_UZ)).toThrow(ValidationError)
        shop.leaveMarketplace()
        expect(shop.marketplace).toBeUndefined()
    })

    it("rejects a broken bot", () => {
        const base = makeBusiness()
        expect(() =>
            Business.register({
                id: "x",
                slug: base.slug,
                name: "X",
                type: base.type,
                ownerTelegramId: base.ownerTelegramId,
                bot: { id: 1, username: " " },
                delivery: { fee: Money.of(0) },
            }),
        ).toThrow(ValidationError)
    })
})
