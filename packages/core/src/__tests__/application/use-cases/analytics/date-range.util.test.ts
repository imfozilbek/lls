import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import {
    getDateRangeForPeriod,
    parseDateRange,
} from "../../../../application/use-cases/analytics/date-range.util.js"

describe("date-range.util", () => {
    describe("getDateRangeForPeriod", () => {
        beforeEach(() => {
            // Mock current date to 2026-01-15 12:00:00
            vi.useFakeTimers()
            vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"))
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it("should return today for 'day' period", () => {
            const range = getDateRangeForPeriod("day")

            expect(range.startDate.getDate()).toBe(15)
            expect(range.startDate.getHours()).toBe(0)
            expect(range.startDate.getMinutes()).toBe(0)

            expect(range.endDate.getDate()).toBe(15)
            expect(range.endDate.getHours()).toBe(23)
            expect(range.endDate.getMinutes()).toBe(59)
        })

        it("should return last 7 days for 'week' period", () => {
            const range = getDateRangeForPeriod("week")

            // Start should be 6 days ago (Jan 9)
            expect(range.startDate.getDate()).toBe(9)
            expect(range.startDate.getHours()).toBe(0)

            // End should be today (Jan 15)
            expect(range.endDate.getDate()).toBe(15)
            expect(range.endDate.getHours()).toBe(23)
        })

        it("should return last 30 days for 'month' period", () => {
            const range = getDateRangeForPeriod("month")

            // Start should be 29 days ago (Dec 17)
            expect(range.startDate.getMonth()).toBe(11) // December
            expect(range.startDate.getDate()).toBe(17)

            // End should be today (Jan 15)
            expect(range.endDate.getMonth()).toBe(0) // January
            expect(range.endDate.getDate()).toBe(15)
        })
    })

    describe("parseDateRange", () => {
        it("should return null when startDate is missing", () => {
            const result = parseDateRange(undefined, "2026-01-31")

            expect(result).toBeNull()
        })

        it("should return null when endDate is missing", () => {
            const result = parseDateRange("2026-01-01", undefined)

            expect(result).toBeNull()
        })

        it("should return null for invalid startDate", () => {
            const result = parseDateRange("not-a-date", "2026-01-31")

            expect(result).toBeNull()
        })

        it("should return null for invalid endDate", () => {
            const result = parseDateRange("2026-01-01", "not-a-date")

            expect(result).toBeNull()
        })

        it("should parse valid date range", () => {
            const result = parseDateRange("2026-01-01", "2026-01-31")

            expect(result).not.toBeNull()
            expect(result!.startDate.getFullYear()).toBe(2026)
            expect(result!.startDate.getMonth()).toBe(0)
            expect(result!.startDate.getDate()).toBe(1)
            expect(result!.startDate.getHours()).toBe(0)

            expect(result!.endDate.getDate()).toBe(31)
            expect(result!.endDate.getHours()).toBe(23)
            expect(result!.endDate.getMinutes()).toBe(59)
        })
    })
})
