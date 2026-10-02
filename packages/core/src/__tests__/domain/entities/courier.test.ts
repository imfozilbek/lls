import { describe, expect, it } from "vitest"

import { COURIER_INVITE_TTL_MS, Courier, CourierInvite } from "../../../domain/entities/courier.js"
import { CourierProfile } from "../../../domain/entities/courier-profile.js"
import { CourierStatus } from "../../../domain/enums/courier-status.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ConflictError } from "../../../domain/errors/conflict.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"

// Friday 2026-09-25, 14:00 in Tashkent (UTC+5).
const NOW = new Date("2026-09-25T09:00:00Z")
const TOMORROW = new Date("2026-09-26T09:00:00Z")
const LATE_TONIGHT = new Date("2026-09-25T18:59:00Z")

function profile(): CourierProfile {
    return CourierProfile.create({ telegramId: TelegramId.create(5005), name: " Jasur ", now: NOW })
}

function join(businessId = "biz-1", person = profile()): Courier {
    return Courier.join({ id: `c-${businessId}`, businessId, profile: person, now: NOW })
}

describe("CourierProfile", () => {
    it("one person: name, phone, vehicle", () => {
        const person = profile()
        expect(person.name).toBe("Jasur")
        person.setPhone(Phone.create("901112233"), NOW)
        person.setVehicle(" Damas ", NOW)
        expect(person.phone?.number).toBe("+998901112233")
        expect(person.vehicle).toBe("Damas")
        person.setVehicle(null, NOW)
        expect(person.vehicle).toBeUndefined()
        expect(() => person.setVehicle("x".repeat(41), NOW)).toThrow(ValidationError)
    })

    it("a shift lasts until the end of the local day", () => {
        const person = profile()
        expect(person.isOnShift(NOW)).toBe(false)
        person.startShift(NOW)
        expect(person.isOnShift(LATE_TONIGHT)).toBe(true)
        // Midnight in Tashkent: a forgotten shift never carries over.
        expect(person.isOnShift(TOMORROW)).toBe(false)
        person.startShift(NOW)
        person.endShift(NOW)
        expect(person.isOnShift(NOW)).toBe(false)
    })
})

describe("Courier (a person's work for one shop)", () => {
    it("joins as pending; the owner approves; works only for that shop", () => {
        const courier = join()
        expect(courier.status).toBe(CourierStatus.PENDING)
        expect(courier.worksFor("biz-1")).toBe(false)
        courier.approve(NOW)
        expect(courier.worksFor("biz-1")).toBe(true)
        expect(courier.worksFor("biz-2")).toBe(false)
        expect(courier.name).toBe("Jasur")
        expect(courier.telegramId.value).toBe(5005)
        expect(() => courier.approve(NOW)).toThrow(ConflictError)
    })

    it("declined, removed, and back to pending with a new invite", () => {
        const declined = join()
        declined.decline(NOW)
        expect(declined.status).toBe(CourierStatus.REMOVED)
        declined.rejoin(NOW)
        expect(declined.isPending).toBe(true)

        const active = join()
        active.approve(NOW)
        active.rejoin(NOW)
        // An approved courier opening another invite of the same shop stays approved.
        expect(active.isActive).toBe(true)
        active.deactivate(NOW)
        expect(active.worksFor("biz-1")).toBe(false)
    })

    it("one person, two shops: each link has its own days, one shift for both", () => {
        const person = profile()
        const food = join("biz-1", person)
        const water = join("biz-2", person)
        food.approve(NOW)
        water.approve(NOW)
        water.setWorkDays(["mon", "tue"], NOW)
        person.startShift(NOW)
        // Friday: works for the food shop, a day off at the water shop.
        expect(food.isAvailable(NOW)).toBe(true)
        expect(water.unavailableReason(NOW)).toBe("day_off")
        expect(water.worksToday(NOW)).toBe(false)
    })

    it("why a courier cannot take an order", () => {
        const person = profile()
        const courier = join("biz-1", person)
        expect(courier.unavailableReason(NOW)).toBe("not_approved")
        courier.approve(NOW)
        expect(courier.unavailableReason(NOW)).toBe("not_on_shift")
        expect(courier.worksToday(NOW)).toBe(true)
        person.startShift(NOW)
        expect(courier.isAvailable(NOW)).toBe(true)
        courier.setOffToday(true, NOW)
        expect(courier.isOffToday(LATE_TONIGHT)).toBe(true)
        expect(courier.unavailableReason(NOW)).toBe("off_today")
        // "Сегодня не работает" ends at midnight, like the stop-list.
        expect(courier.isOffToday(TOMORROW)).toBe(false)
        courier.setOffToday(false, NOW)
        expect(courier.isAvailable(NOW)).toBe(true)
    })

    it("work days: at least one, each once, kept Monday first", () => {
        const courier = join()
        courier.setWorkDays(["sun", "mon"], NOW)
        expect(courier.workDays).toEqual(["mon", "sun"])
        expect(() => courier.setWorkDays([], NOW)).toThrow(ValidationError)
        expect(() => courier.setWorkDays(["mon", "mon"], NOW)).toThrow(ValidationError)
        expect(() => courier.setWorkDays(["holiday"], NOW)).toThrow(ValidationError)
    })

    it("reconstitutes", () => {
        const courier = join()
        const copy = Courier.reconstitute({
            id: courier.id,
            businessId: courier.businessId,
            profile: courier.profile,
            status: CourierStatus.REMOVED,
            workDays: ["fri"],
            offUntil: TOMORROW,
            createdAt: courier.createdAt,
            updatedAt: courier.updatedAt,
        })
        expect(copy.isActive).toBe(false)
        expect(copy.workDays).toEqual(["fri"])
        expect(copy.offUntil).toBe(TOMORROW)
        expect(copy.createdAt).toBe(NOW)
    })
})

describe("CourierInvite", () => {
    it("works once, for two days", () => {
        const invite = CourierInvite.create({ code: "abc", businessId: "biz-1", now: NOW })
        expect(invite.expiresAt.getTime() - NOW.getTime()).toBe(COURIER_INVITE_TTL_MS)
        invite.use(NOW)
        expect(invite.usedAt).toBe(NOW)
        expect(() => invite.use(NOW)).toThrow(BusinessRuleViolationError)
    })

    it("expires", () => {
        const invite = CourierInvite.reconstitute({
            code: "abc",
            businessId: "biz-1",
            createdAt: NOW,
            expiresAt: NOW,
        })
        expect(invite.code).toBe("abc")
        expect(invite.businessId).toBe("biz-1")
        expect(invite.createdAt).toBe(NOW)
        expect(() => invite.use(NOW)).toThrow(/expired/)
    })
})
