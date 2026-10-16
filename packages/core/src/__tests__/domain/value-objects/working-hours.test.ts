import { describe, expect, it } from "vitest"

import { ValidationError } from "../../../domain/errors/validation.error.js"
import { WorkingHours, nextOpening } from "../../../domain/value-objects/working-hours.js"

/** Build a UTC instant from Tashkent local time (UTC+5). 2026-09-28 is a Monday. */
function tashkent(isoLocal: string): Date {
    return new Date(`${isoLocal}+05:00`)
}

describe("WorkingHours", () => {
    it("always open by default", () => {
        const hours = WorkingHours.alwaysOpen()
        expect(hours.toJSON()).toBeNull()
        expect(hours.isOpenAt(tashkent("2026-09-28T03:00:00"))).toBe(true)
        expect(hours.toJSON()).toBeNull()
    })

    it("regular day hours in Tashkent time, not UTC", () => {
        const hours = WorkingHours.create({ mon: { open: "09:00", close: "18:00" } })
        expect(hours.isOpenAt(tashkent("2026-09-28T09:00:00"))).toBe(true)
        expect(hours.isOpenAt(tashkent("2026-09-28T17:59:00"))).toBe(true)
        expect(hours.isOpenAt(tashkent("2026-09-28T18:00:00"))).toBe(false)
        expect(hours.isOpenAt(tashkent("2026-09-28T08:59:00"))).toBe(false)
        // Tuesday is not in the schedule
        expect(hours.isOpenAt(tashkent("2026-09-29T12:00:00"))).toBe(false)
    })

    it("overnight hours continue after midnight into the next day", () => {
        const hours = WorkingHours.create({ fri: { open: "22:00", close: "04:00" } })
        // Friday 2026-10-02
        expect(hours.isOpenAt(tashkent("2026-10-02T23:30:00"))).toBe(true)
        // Saturday 01:00 is still Friday's shift
        expect(hours.isOpenAt(tashkent("2026-10-03T01:00:00"))).toBe(true)
        expect(hours.isOpenAt(tashkent("2026-10-03T04:00:00"))).toBe(false)
        expect(hours.isOpenAt(tashkent("2026-10-02T21:59:00"))).toBe(false)
    })

    it("open equals close means open all day", () => {
        const hours = WorkingHours.create({ sun: { open: "00:00", close: "00:00" } })
        expect(hours.isOpenAt(tashkent("2026-10-04T03:00:00"))).toBe(true)
        expect(hours.isOpenAt(tashkent("2026-10-05T03:00:00"))).toBe(false)
    })

    it("validates time format", () => {
        expect(() => WorkingHours.create({ mon: { open: "9:00", close: "18:00" } })).toThrow(
            ValidationError,
        )
        expect(() => WorkingHours.create({ mon: { open: "09:00", close: "24:00" } })).toThrow(
            ValidationError,
        )
    })

    it("round-trips through JSON", () => {
        const schedule = { mon: { open: "09:00", close: "18:00" } }
        expect(WorkingHours.fromJSON(schedule).toJSON()).toEqual(schedule)
        expect(WorkingHours.fromJSON(null).toJSON()).toBeNull()
    })
})

describe("nextOpening", () => {
    const week = { mon: { open: "09:00", close: "18:00" }, wed: { open: "10:00", close: "20:00" } }

    it("later today before the opening", () => {
        expect(nextOpening(week, tashkent("2026-09-28T07:30:00"))).toEqual({
            inDays: 0,
            weekday: "mon",
            time: "09:00",
        })
    })

    it("skips a day off after closing", () => {
        expect(nextOpening(week, tashkent("2026-09-28T19:00:00"))).toEqual({
            inDays: 2,
            weekday: "wed",
            time: "10:00",
        })
    })

    it("the same weekday next week when it is the only day", () => {
        const monday = { mon: { open: "09:00", close: "18:00" } }
        expect(nextOpening(monday, tashkent("2026-09-28T19:00:00"))?.inDays).toBe(7)
    })

    it("none for an empty week", () => {
        expect(nextOpening({}, tashkent("2026-09-28T12:00:00"))).toBeNull()
    })
})
