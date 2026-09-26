import { describe, expect, it } from "vitest"

import { Language, languageFromTelegram } from "../../../domain/enums/language.js"
import {
    ACTIVE_ORDER_STATUSES,
    OrderStatus,
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

describe("languageFromTelegram", () => {
    it("maps ru to Russian and everything else to Uzbek", () => {
        expect(languageFromTelegram("ru")).toBe(Language.RU)
        expect(languageFromTelegram("RU-ru")).toBe(Language.RU)
        expect(languageFromTelegram("uz")).toBe(Language.UZ)
        expect(languageFromTelegram("en")).toBe(Language.UZ)
        expect(languageFromTelegram(undefined)).toBe(Language.UZ)
    })
})
