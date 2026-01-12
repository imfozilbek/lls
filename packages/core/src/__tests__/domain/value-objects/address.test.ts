import { describe, it, expect } from "vitest"

import { Address } from "../../../domain/value-objects/address.js"

describe("Address", () => {
    describe("create", () => {
        it("should create address with street and city", () => {
            const address = Address.create("Main St 123", "Tashkent")
            expect(address.street).toBe("Main St 123")
            expect(address.city).toBe("Tashkent")
        })

        it("should create address with coordinates", () => {
            const address = Address.create("Main St", "Tashkent", {
                latitude: 41.2995,
                longitude: 69.2401,
            })
            expect(address.coordinates?.latitude).toBe(41.2995)
            expect(address.coordinates?.longitude).toBe(69.2401)
        })

        it("should throw on empty street", () => {
            expect(() => Address.create("", "Tashkent")).toThrow()
        })

        it("should throw on empty city", () => {
            expect(() => Address.create("Main St", "")).toThrow()
        })
    })

    describe("format", () => {
        it("should format address as string", () => {
            const address = Address.create("Main St 123", "Tashkent")
            expect(address.format()).toBe("Main St 123, Tashkent")
        })
    })

    describe("hasCoordinates", () => {
        it("should return true when coordinates exist", () => {
            const address = Address.create("Main St", "Tashkent", {
                latitude: 41.2995,
                longitude: 69.2401,
            })
            expect(address.hasCoordinates()).toBe(true)
        })

        it("should return false when no coordinates", () => {
            const address = Address.create("Main St", "Tashkent")
            expect(address.hasCoordinates()).toBe(false)
        })
    })

    describe("equals", () => {
        it("should return true for equal addresses", () => {
            const a = Address.create("Main St", "Tashkent")
            const b = Address.create("Main St", "Tashkent")
            expect(a.equals(b)).toBe(true)
        })

        it("should return false for different addresses", () => {
            const a = Address.create("Main St", "Tashkent")
            const b = Address.create("Other St", "Tashkent")
            expect(a.equals(b)).toBe(false)
        })
    })
})
