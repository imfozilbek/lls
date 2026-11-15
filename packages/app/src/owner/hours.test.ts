import { describe, expect, it } from "vitest"

import {
    DEFAULT_CLOSE,
    DEFAULT_OPEN,
    hasOpenDay,
    hoursOf,
    sameAsMonday,
    scheduleOf,
    timeChoices,
} from "./hours.js"

describe("working hours per day", () => {
    it("always open: every day on, default times, no schedule", () => {
        const hours = hoursOf(null)
        expect(hours.alwaysOpen).toBe(true)
        expect(hours.days).toHaveLength(7)
        expect(hours.days.every((d) => d.open && d.from === DEFAULT_OPEN)).toBe(true)
        expect(scheduleOf(hours)).toBeNull()
    })

    it("keeps each day's own hours and closed days", () => {
        const schedule = {
            tue: { open: "09:00", close: "18:00" },
            fri: { open: "10:00", close: "02:00" },
        }
        const hours = hoursOf(schedule)
        expect(hours.days[0]).toEqual({ open: false, from: DEFAULT_OPEN, to: DEFAULT_CLOSE })
        expect(hours.days[1]).toEqual({ open: true, from: "09:00", to: "18:00" })
        expect(scheduleOf(hours)).toEqual(schedule)
    })

    it("copies Monday to every day", () => {
        const hours = sameAsMonday(hoursOf({ mon: { open: "08:00", close: "20:00" } }))
        expect(scheduleOf(hours)).toEqual(
            Object.fromEntries(
                ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
                    d,
                    { open: "08:00", close: "20:00" },
                ]),
            ),
        )
    })

    it("needs at least one working day", () => {
        expect(hasOpenDay(hoursOf({}))).toBe(false)
        expect(hasOpenDay(hoursOf(null))).toBe(true)
        expect(hasOpenDay(hoursOf({ sun: { open: "09:00", close: "13:00" } }))).toBe(true)
    })
})

describe("timeChoices", () => {
    it("every 15 minutes in 24 hours, keeping a time off the grid", () => {
        const grid = timeChoices("09:00")
        expect(grid).toHaveLength(96)
        expect(grid[0]).toBe("00:00")
        expect(grid[grid.length - 1]).toBe("23:45")
        expect(timeChoices("09:10")).toContain("09:10")
        expect(timeChoices("09:10")).toHaveLength(97)
    })
})
