import { describe, expect, it } from "vitest"

import { COURIER_INVITE_TTL_MS, Courier, CourierInvite } from "../../../domain/entities/courier.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"

const NOW = new Date("2026-09-26T09:00:00Z")

function join(): Courier {
    return Courier.join({
        id: "c1",
        businessId: "biz-1",
        telegramId: TelegramId.create(5005),
        name: " Jasur ",
        now: NOW,
    })
}

describe("Courier", () => {
    it("joins one shop and works only for it", () => {
        const courier = join()
        expect(courier.name).toBe("Jasur")
        expect(courier.worksFor("biz-1")).toBe(true)
        expect(courier.worksFor("biz-2")).toBe(false)
        expect(courier.createdAt).toBe(NOW)
    })

    it("leaves and comes back with a new invite", () => {
        const courier = join()
        courier.deactivate(NOW)
        expect(courier.isActive).toBe(false)
        expect(courier.worksFor("biz-1")).toBe(false)
        courier.rejoin("Jasur aka", NOW)
        expect(courier.worksFor("biz-1")).toBe(true)
        expect(courier.name).toBe("Jasur aka")
        expect(() => courier.rejoin(" ", NOW)).toThrow(ValidationError)
    })

    it("keeps a phone", () => {
        const courier = join()
        courier.setPhone(Phone.create("901112233"), NOW)
        expect(courier.phone?.number).toBe("+998901112233")
    })

    it("reconstitutes", () => {
        const courier = join()
        const copy = Courier.reconstitute({
            id: courier.id,
            businessId: courier.businessId,
            telegramId: courier.telegramId,
            name: courier.name,
            isActive: false,
            createdAt: courier.createdAt,
            updatedAt: courier.updatedAt,
        })
        expect(copy.isActive).toBe(false)
        expect(copy.telegramId.value).toBe(5005)
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
