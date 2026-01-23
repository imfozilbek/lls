import { describe, it, expect } from "vitest"

import {
    isBusinessOpen,
    getTodayHours,
    getNextOpeningTime,
    validateBusinessHours,
    createDefaultBusinessHours,
} from "../../../domain/rules/business-hours.js"

import type { BusinessHours } from "../../../domain/rules/business-hours.js"

describe("isBusinessOpen", () => {
    const businessHours: BusinessHours = {
        monday: { open: "09:00", close: "18:00" },
        tuesday: { open: "09:00", close: "18:00" },
        wednesday: { open: "09:00", close: "18:00" },
        thursday: { open: "09:00", close: "18:00" },
        friday: { open: "09:00", close: "18:00" },
    }

    it("should return true when business is open", () => {
        // Monday at 12:00
        const date = new Date("2026-01-26T12:00:00")
        expect(isBusinessOpen(businessHours, date)).toBe(true)
    })

    it("should return false when business is closed (before opening)", () => {
        // Monday at 08:00
        const date = new Date("2026-01-26T08:00:00")
        expect(isBusinessOpen(businessHours, date)).toBe(false)
    })

    it("should return false when business is closed (after closing)", () => {
        // Monday at 19:00
        const date = new Date("2026-01-26T19:00:00")
        expect(isBusinessOpen(businessHours, date)).toBe(false)
    })

    it("should return false on closed days", () => {
        // Saturday
        const date = new Date("2026-01-31T12:00:00")
        expect(isBusinessOpen(businessHours, date)).toBe(false)
    })

    it("should return true at opening time", () => {
        // Monday at 09:00
        const date = new Date("2026-01-26T09:00:00")
        expect(isBusinessOpen(businessHours, date)).toBe(true)
    })

    it("should return false at closing time", () => {
        // Monday at 18:00
        const date = new Date("2026-01-26T18:00:00")
        expect(isBusinessOpen(businessHours, date)).toBe(false)
    })

    it("should handle overnight hours", () => {
        const nightBusiness: BusinessHours = {
            friday: { open: "22:00", close: "04:00" },
        }

        // Friday at 23:00
        const fridayNight = new Date("2026-01-30T23:00:00")
        expect(isBusinessOpen(nightBusiness, fridayNight)).toBe(true)

        // Friday at 21:00
        const fridayEvening = new Date("2026-01-30T21:00:00")
        expect(isBusinessOpen(nightBusiness, fridayEvening)).toBe(false)
    })
})

describe("getTodayHours", () => {
    const businessHours: BusinessHours = {
        monday: { open: "09:00", close: "18:00" },
        tuesday: { open: "10:00", close: "19:00" },
    }

    it("should return today's hours", () => {
        // Monday
        const monday = new Date("2026-01-26T12:00:00")
        const hours = getTodayHours(businessHours, monday)
        expect(hours).toEqual({ open: "09:00", close: "18:00" })
    })

    it("should return null for closed days", () => {
        // Saturday
        const saturday = new Date("2026-01-31T12:00:00")
        const hours = getTodayHours(businessHours, saturday)
        expect(hours).toBeNull()
    })
})

describe("getNextOpeningTime", () => {
    const businessHours: BusinessHours = {
        monday: { open: "09:00", close: "18:00" },
        wednesday: { open: "09:00", close: "18:00" },
    }

    it("should return next opening time", () => {
        // Tuesday at 12:00 - next open is Wednesday
        const tuesday = new Date("2026-01-27T12:00:00")
        const nextOpen = getNextOpeningTime(businessHours, tuesday)

        expect(nextOpen).not.toBeNull()
        expect(nextOpen?.getDay()).toBe(3) // Wednesday
        expect(nextOpen?.getHours()).toBe(9)
    })

    it("should skip today if past opening time", () => {
        // Monday at 12:00 - next open is Wednesday
        const monday = new Date("2026-01-26T12:00:00")
        const nextOpen = getNextOpeningTime(businessHours, monday)

        expect(nextOpen).not.toBeNull()
        expect(nextOpen?.getDay()).toBe(3) // Wednesday
    })

    it("should return null if no hours defined", () => {
        const emptyHours: BusinessHours = {}
        const date = new Date("2026-01-26T12:00:00")
        const nextOpen = getNextOpeningTime(emptyHours, date)

        expect(nextOpen).toBeNull()
    })
})

describe("validateBusinessHours", () => {
    it("should return empty array for valid hours", () => {
        const hours: BusinessHours = {
            monday: { open: "09:00", close: "18:00" },
        }
        const errors = validateBusinessHours(hours)
        expect(errors).toHaveLength(0)
    })

    it("should return error for invalid open time", () => {
        const hours: BusinessHours = {
            monday: { open: "25:00", close: "18:00" },
        }
        const errors = validateBusinessHours(hours)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0]).toContain("Invalid open time")
    })

    it("should return error for invalid close time", () => {
        const hours: BusinessHours = {
            monday: { open: "09:00", close: "invalid" },
        }
        const errors = validateBusinessHours(hours)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0]).toContain("Invalid close time")
    })

    it("should validate all days", () => {
        const hours: BusinessHours = {
            monday: { open: "invalid", close: "invalid" },
            tuesday: { open: "invalid", close: "invalid" },
        }
        const errors = validateBusinessHours(hours)
        expect(errors.length).toBe(4)
    })
})

describe("createDefaultBusinessHours", () => {
    it("should create Mon-Fri 9-18 hours", () => {
        const hours = createDefaultBusinessHours()

        expect(hours.monday).toEqual({ open: "09:00", close: "18:00" })
        expect(hours.tuesday).toEqual({ open: "09:00", close: "18:00" })
        expect(hours.wednesday).toEqual({ open: "09:00", close: "18:00" })
        expect(hours.thursday).toEqual({ open: "09:00", close: "18:00" })
        expect(hours.friday).toEqual({ open: "09:00", close: "18:00" })
        expect(hours.saturday).toBeUndefined()
        expect(hours.sunday).toBeUndefined()
    })
})
