import { describe, it, expect } from "vitest"

import { Business } from "../../../domain/entities/business.js"
import { BusinessType } from "../../../domain/enums/business-type.js"
import { Address } from "../../../domain/value-objects/address.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"

describe("Business", () => {
    const createBusiness = (): Business => {
        return Business.create({
            id: "test-id",
            name: "Test Business",
            type: BusinessType.FOOD,
            address: Address.create("Main St", "Tashkent"),
            telegramId: TelegramId.create(123456789),
        })
    }

    describe("create", () => {
        it("should create business with valid data", () => {
            const business = createBusiness()
            expect(business.id).toBe("test-id")
            expect(business.name).toBe("Test Business")
            expect(business.type).toBe(BusinessType.FOOD)
            expect(business.isActive).toBe(true)
        })

        it("should set timestamps on creation", () => {
            const business = createBusiness()
            expect(business.createdAt).toBeInstanceOf(Date)
            expect(business.updatedAt).toBeInstanceOf(Date)
        })
    })

    describe("updateName", () => {
        it("should update business name", () => {
            const business = createBusiness()
            business.updateName("New Name")
            expect(business.name).toBe("New Name")
        })

        it("should throw on empty name", () => {
            const business = createBusiness()
            expect(() => business.updateName("")).toThrow()
        })
    })

    describe("updateAddress", () => {
        it("should update business address", () => {
            const business = createBusiness()
            const newAddress = Address.create("New St", "Samarkand")
            business.updateAddress(newAddress)
            expect(business.address.city).toBe("Samarkand")
        })
    })

    describe("activate/deactivate", () => {
        it("should deactivate business", () => {
            const business = createBusiness()
            business.deactivate()
            expect(business.isActive).toBe(false)
        })

        it("should activate business", () => {
            const business = createBusiness()
            business.deactivate()
            business.activate()
            expect(business.isActive).toBe(true)
        })
    })

    describe("toJSON", () => {
        it("should serialize business to JSON", () => {
            const business = createBusiness()
            const json = business.toJSON()
            expect(json.id).toBe("test-id")
            expect(json.name).toBe("Test Business")
        })
    })

    describe("reconstitute", () => {
        it("should reconstitute business from props", () => {
            const now = new Date()
            const business = Business.reconstitute({
                id: "test-id",
                name: "Test Business",
                type: BusinessType.FOOD,
                address: Address.create("Main St", "Tashkent"),
                telegramId: TelegramId.create(123456789),
                isActive: false,
                createdAt: now,
                updatedAt: now,
            })
            expect(business.isActive).toBe(false)
        })
    })
})
