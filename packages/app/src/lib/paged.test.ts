import { describe, expect, it } from "vitest"

import { keepOpenedPages, totalAfterRefresh } from "./paged.js"

const page = (ids: string[], limit = 2): { data: { id: string }[]; meta: never } => ({
    data: ids.map((id) => ({ id })),
    meta: { page: 1, limit, total: 9 } as never,
})

describe("a list refreshed on a timer", () => {
    it("keeps the pages opened with «Yana», without repeats", () => {
        const opened = ["a", "b", "c", "d"].map((id) => ({ id }))
        // A new order came first: «b» moved to page two, so it must not show twice.
        expect(keepOpenedPages(opened, page(["n", "a"])).map((o) => o.id)).toEqual([
            "n",
            "a",
            "c",
            "d",
        ])
    })

    it("only the first page open: the fresh page as it is", () => {
        expect(keepOpenedPages([{ id: "a" }], page(["n", "a"])).map((o) => o.id)).toEqual([
            "n",
            "a",
        ])
        expect(keepOpenedPages(null, page(["n"])).map((o) => o.id)).toEqual(["n"])
    })
})

describe("«Yana» after a refresh", () => {
    const first = (total: number): { data: { id: string }[]; meta: never } => ({
        data: [{ id: "a" }, { id: "b" }],
        meta: { page: 1, limit: 2, total } as never,
    })

    it("pages opened beyond the first keep what was known of the rest", () => {
        // Six shown of at least seven; the fresh first page only knows «at least three».
        expect(totalAfterRefresh(7, 6, first(3))).toBe(7)
    })

    it("only the first page open: the fresh page decides", () => {
        expect(totalAfterRefresh(7, 2, first(2))).toBe(2)
        expect(totalAfterRefresh(2, 2, first(3))).toBe(3)
    })
})
