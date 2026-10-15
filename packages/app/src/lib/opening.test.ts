import { describe, expect, it } from "vitest"

import { Language } from "@zumda/core"

import { dictionaryFor } from "../i18n/index.js"
import { opensWhen } from "./opening.js"

const t = dictionaryFor(Language.UZ)
const week = { mon: { open: "09:00", close: "18:00" }, wed: { open: "10:30", close: "20:00" } }

/** 2026-09-28 is a Monday; Tashkent is UTC+5. */
function tashkent(isoLocal: string): Date {
    return new Date(`${isoLocal}+05:00`)
}

describe("opensWhen", () => {
    it("today, without the leading zero", () => {
        expect(opensWhen(t, week, tashkent("2026-09-28T07:00:00"))).toBe("bugun soat 9:00 da")
    })

    it("a weekday ahead after a day off", () => {
        expect(opensWhen(t, week, tashkent("2026-09-28T19:00:00"))).toBe("chorshanba soat 10:30 da")
    })

    it("tomorrow", () => {
        expect(opensWhen(t, week, tashkent("2026-09-27T19:00:00"))).toBe("ertaga soat 9:00 da")
    })

    it("nothing for a shop without hours", () => {
        expect(opensWhen(t, null)).toBeNull()
    })
})
