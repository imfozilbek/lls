import { describe, expect, it } from "vitest"

import {
    DEFAULT_FEATURES,
    SHELF_OF,
    SUGGESTED_CATEGORIES,
    SUGGESTED_UNITS,
} from "../../../domain/enums/business-profile.js"
import { BUSINESS_TYPES, BusinessType } from "../../../domain/enums/business-type.js"
import {
    CATEGORIES,
    CATEGORY_GROUPS,
    CategoryGroup,
    categoriesOf,
    categoryGroup,
} from "../../../domain/enums/category.js"
import { Feature } from "../../../domain/enums/feature.js"
import { Language, languageFromTelegram, toLanguage } from "../../../domain/enums/language.js"
import {
    UNITS,
    Unit,
    defaultStep,
    isBottleUnit,
    isWeightUnit,
    packagesOf,
    unitScale,
} from "../../../domain/enums/unit.js"
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
        expect(DEFAULT_FEATURES[BusinessType.GROCERY]).toContain(Feature.WEIGHT_ITEMS)
        expect(SUGGESTED_UNITS[BusinessType.SERVICE][0]).toBe(Unit.PIECE)
    })

    it("four kinds: a grocery store (water too), a restaurant, a service, a goods store", () => {
        expect(BUSINESS_TYPES).toEqual([
            BusinessType.GROCERY,
            BusinessType.FOOD,
            BusinessType.SERVICE,
            BusinessType.STORE,
        ])
        expect(SUGGESTED_CATEGORIES[BusinessType.STORE][0]).toBe("household")
        expect(SUGGESTED_UNITS[BusinessType.STORE]).toContain(Unit.METRE)
        expect(SHELF_OF[BusinessType.STORE]).toBe(CategoryGroup.GOODS)
        // A water shop is a grocery store: 19 l bottles and the water category are offered there,
        // and the bottle deposit is a switch the owner turns on.
        expect(SUGGESTED_UNITS[BusinessType.GROCERY]).toContain(Unit.BOTTLE_19L)
        expect(SUGGESTED_CATEGORIES[BusinessType.GROCERY]).toContain("water")
        expect(DEFAULT_FEATURES[BusinessType.SERVICE]).not.toContain(Feature.BOTTLE_DEPOSIT)
        expect(SUGGESTED_CATEGORIES[BusinessType.SERVICE]).toContain("cleaning")
    })

    it("counts weight in grams: a price per kg, per 100 g or per gram", () => {
        expect(unitScale(Unit.KG)).toBe(1000)
        expect(unitScale(Unit.G100)).toBe(100)
        expect(unitScale(Unit.GRAM)).toBe(1)
        expect(unitScale(Unit.PIECE)).toBe(1)
        expect(unitScale(Unit.SQUARE_METRE)).toBe(1)
        expect([Unit.KG, Unit.G100, Unit.GRAM].every(isWeightUnit)).toBe(true)
        expect(isWeightUnit(Unit.LITER)).toBe(false)
        expect(defaultStep(Unit.KG)).toBe(500)
        expect(defaultStep(Unit.G100)).toBe(100)
        expect(defaultStep(Unit.GRAM)).toBe(1)
        expect(defaultStep(Unit.PACK)).toBe(1)
    })

    it("a courier carries pieces as counted, a measured line as one package", () => {
        expect(packagesOf(Unit.PIECE, 3)).toBe(3)
        expect(packagesOf(Unit.BOTTLE_20L, 2)).toBe(2)
        expect(packagesOf(Unit.KG, 1500)).toBe(1)
        expect(packagesOf(Unit.SQUARE_METRE, 12)).toBe(1)
        expect(packagesOf(Unit.HOUR, 3)).toBe(1)
        expect(isBottleUnit(Unit.BOTTLE_20L)).toBe(true)
        expect(isBottleUnit(Unit.LITER)).toBe(false)
    })

    it("every category stands on one shelf; ids are unique and old ones stay", () => {
        expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length)
        const shelves = CATEGORY_GROUPS.flatMap((group) => categoriesOf(group))
        expect(shelves.sort()).toEqual([...CATEGORIES].sort())
        expect(categoryGroup("osh")).toBe(CategoryGroup.FOOD)
        expect(categoryGroup("spices")).toBe(CategoryGroup.GROCERY)
        expect(categoryGroup("building")).toBe(CategoryGroup.GOODS)
        expect(categoryGroup("carpet")).toBe(CategoryGroup.SERVICES)
        expect(categoryGroup("other")).toBe(CategoryGroup.SERVICES)
        // The first taxonomy's ids are stored in products and orders: never renamed.
        for (const id of ["meals", "soups", "water", "groceries", "household", "beauty", "other"]) {
            expect(CATEGORIES).toContain(id)
        }
        for (const type of BUSINESS_TYPES) {
            expect(SUGGESTED_CATEGORIES[type].every((c) => CATEGORIES.includes(c))).toBe(true)
        }
    })
})

describe("languageFromTelegram", () => {
    it("maps ru to Russian and everything else to Uzbek", () => {
        // Only Uzbek in the product: any other Telegram language reads as Uzbek.
        expect(languageFromTelegram("ru")).toBe(Language.UZ)
        expect(languageFromTelegram("UZ-latn")).toBe(Language.UZ)
        expect(toLanguage("ru")).toBe(Language.UZ)
        expect(toLanguage(null)).toBe(Language.UZ)
        expect(languageFromTelegram("uz")).toBe(Language.UZ)
        expect(languageFromTelegram("en")).toBe(Language.UZ)
        expect(languageFromTelegram(undefined)).toBe(Language.UZ)
    })
})
