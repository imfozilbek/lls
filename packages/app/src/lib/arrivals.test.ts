import { describe, expect, it } from "vitest"

import { hasNews } from "./arrivals.js"

const look = (entries: [string, string][]): Map<string, string> => new Map(entries)

describe("news between two looks at a list", () => {
    it("the first look is what was already there", () => {
        expect(hasNews(null, look([["o1", "pending"]]))).toBe(false)
    })

    it("a new item is news; the same items are not; one gone is not", () => {
        const before = look([["o1", "pending"]])
        expect(hasNews(before, look([["o1", "pending"]]))).toBe(false)
        expect(hasNews(before, look([]))).toBe(false)
        expect(
            hasNews(
                before,
                look([
                    ["o1", "pending"],
                    ["o2", "pending"],
                ]),
            ),
        ).toBe(true)
    })

    it("a changed state is news only when it rings", () => {
        const before = look([["o1", "pending:unpaid"]])
        const sent = look([["o1", "pending:awaiting"]])
        const ringsOnSent = (state: string): boolean => state.endsWith(":awaiting")
        expect(hasNews(before, sent, ringsOnSent)).toBe(true)
        expect(hasNews(sent, look([["o1", "accepted:paid"]]), ringsOnSent)).toBe(false)
    })
})
