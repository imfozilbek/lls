import { describe, it, expect } from "vitest"

import { Courier } from "../../../domain/entities/courier.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"

describe("Courier", () => {
    const createCourier = (): Courier => {
        return Courier.create({
            id: "courier-id",
            telegramId: TelegramId.create(123456789),
            name: "John Courier",
            phone: Phone.create("+998901234567"),
        })
    }

    describe("create", () => {
        it("should create courier with valid data", () => {
            const courier = createCourier()
            expect(courier.id).toBe("courier-id")
            expect(courier.name).toBe("John Courier")
            expect(courier.isAvailable).toBe(true)
            expect(courier.isActive).toBe(true)
        })
    })

    describe("updateProfile", () => {
        it("should update courier profile", () => {
            const courier = createCourier()
            const newPhone = Phone.create("+998909876543")
            courier.updateProfile("New Name", newPhone)
            expect(courier.name).toBe("New Name")
        })
    })

    describe("goOnline/goOffline", () => {
        it("should go offline", () => {
            const courier = createCourier()
            courier.goOffline()
            expect(courier.isAvailable).toBe(false)
        })

        it("should go online", () => {
            const courier = createCourier()
            courier.goOffline()
            courier.goOnline()
            expect(courier.isAvailable).toBe(true)
        })
    })

    describe("activate/deactivate", () => {
        it("should deactivate courier", () => {
            const courier = createCourier()
            courier.deactivate()
            expect(courier.isActive).toBe(false)
            expect(courier.isAvailable).toBe(false)
        })

        it("should activate courier", () => {
            const courier = createCourier()
            courier.deactivate()
            courier.activate()
            expect(courier.isActive).toBe(true)
        })
    })

    describe("canTakeOrder", () => {
        it("should return true when active and available", () => {
            const courier = createCourier()
            expect(courier.canTakeOrder()).toBe(true)
        })

        it("should return false when not available", () => {
            const courier = createCourier()
            courier.goOffline()
            expect(courier.canTakeOrder()).toBe(false)
        })

        it("should return false when not active", () => {
            const courier = createCourier()
            courier.deactivate()
            expect(courier.canTakeOrder()).toBe(false)
        })
    })
})
