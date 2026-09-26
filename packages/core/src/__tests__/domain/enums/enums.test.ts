import { describe, expect, it } from "vitest"

import {
    DEFAULT_FEATURES,
    SUGGESTED_CATEGORIES,
    SUGGESTED_UNITS,
} from "../../../domain/enums/business-profile.js"
import { BUSINESS_TYPES, BusinessType } from "../../../domain/enums/business-type.js"
import { CATEGORIES } from "../../../domain/enums/category.js"
import { Feature } from "../../../domain/enums/feature.js"
import { Language, languageFromTelegram } from "../../../domain/enums/language.js"
import { UNITS, Unit, unitScale } from "../../../domain/enums/unit.js"
import {
    ACTIVE_ORDER_STATUSES,
    OrderStatus,
    canActorMove,
    canTransitionTo,
    getNextStatus,
    isFinalStatus,
} from "../../../domain/enums/order-status.js"

describe("order status", () => {
    it("follows the forward flow", () => {
        expect(getNextStatus(OrderStatus.PENDING)).toBe(OrderStatus.ACCEPTED)
        expect(getNextStatus(OrderStatus.ACCEPTED)).toBe(OrderStatus.PREPARING)
        expect(getNextStatus(OrderStatus.PREPARING)).toBe(OrderStatus.READY)
        expect(getNextStatus(OrderStatus.READY)).toBe(OrderStatus.PICKED_UP)
        expect(getNextStatus(OrderStatus.PICKED_UP)).toBe(OrderStatus.DELIVERED)
        expect(getNextStatus(OrderStatus.DELIVERED)).toBeNull()
        expect(getNextStatus(OrderStatus.CANCELLED)).toBeNull()
    })

    it("allows cancel from every active status", () => {
        for (const status of ACTIVE_ORDER_STATUSES) {
            expect(canTransitionTo(status, OrderStatus.CANCELLED)).toBe(true)
        }
    })

    it("does not skip steps or leave final statuses", () => {
        expect(canTransitionTo(OrderStatus.PREPARING, OrderStatus.PICKED_UP)).toBe(false)
        expect(canTransitionTo(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false)
        expect(isFinalStatus(OrderStatus.DELIVERED)).toBe(true)
        expect(isFinalStatus(OrderStatus.CANCELLED)).toBe(true)
        expect(ACTIVE_ORDER_STATUSES).toHaveLength(5)
    })
})

describe("who may move an order", () => {
    const S = OrderStatus
    it("the owner makes every allowed step", () => {
        expect(canActorMove("owner", S.PENDING, S.ACCEPTED)).toBe(true)
        expect(canActorMove("owner", S.PICKED_UP, S.CANCELLED)).toBe(true)
        expect(canActorMove("owner", S.PENDING, S.READY)).toBe(false)
    })

    it("the courier only picks up and delivers", () => {
        expect(canActorMove("courier", S.READY, S.PICKED_UP)).toBe(true)
        expect(canActorMove("courier", S.PICKED_UP, S.DELIVERED)).toBe(true)
        expect(canActorMove("courier", S.ACCEPTED, S.PREPARING)).toBe(false)
        expect(canActorMove("courier", S.READY, S.CANCELLED)).toBe(false)
    })

    it("the customer only cancels a pending order", () => {
        expect(canActorMove("customer", S.PENDING, S.CANCELLED)).toBe(true)
        expect(canActorMove("customer", S.ACCEPTED, S.CANCELLED)).toBe(false)
        expect(canActorMove("customer", S.PENDING, S.ACCEPTED)).toBe(false)
    })
})

describe("business profiles", () => {
    it("every business type has defaults from the shared taxonomy", () => {
        for (const type of BUSINESS_TYPES) {
            expect(SUGGESTED_CATEGORIES[type].every((c) => CATEGORIES.includes(c))).toBe(true)
            expect(SUGGESTED_UNITS[type].every((u) => UNITS.includes(u))).toBe(true)
        }
        expect(DEFAULT_FEATURES[BusinessType.WATER]).toContain(Feature.BOTTLE_DEPOSIT)
        expect(DEFAULT_FEATURES[BusinessType.GROCERY]).toContain(Feature.WEIGHT_ITEMS)
        expect(SUGGESTED_UNITS[BusinessType.WATER][0]).toBe(Unit.BOTTLE_19L)
    })

    it("counts kilograms in grams", () => {
        expect(unitScale(Unit.KG)).toBe(1000)
        expect(unitScale(Unit.PIECE)).toBe(1)
    })
})

describe("languageFromTelegram", () => {
    it("maps ru to Russian and everything else to Uzbek", () => {
        expect(languageFromTelegram("ru")).toBe(Language.RU)
        expect(languageFromTelegram("RU-ru")).toBe(Language.RU)
        expect(languageFromTelegram("uz")).toBe(Language.UZ)
        expect(languageFromTelegram("en")).toBe(Language.UZ)
        expect(languageFromTelegram(undefined)).toBe(Language.UZ)
    })
})
