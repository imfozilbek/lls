import { describe, expect, it } from "vitest"

import { keepOpenedPages } from "./paged.js"

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
