import { describe, expect, it } from "vitest"

import { canTakeOut } from "./missing-line.js"

import type { OrderDTO } from "@zumda/core"

/** Plain strings, as the server sends them. */
function order(status: string, lines = 2): OrderDTO {
    return {
        status,
        items: Array.from({ length: lines }, (_, line) => ({ line, name: `Mahsulot ${line}` })),
    } as unknown as OrderDTO
}

describe("«Yo'q» on a line (owner's decision, November 2026)", () => {
    it("in the queue and while it is collected", () => {
        expect(canTakeOut(order("accepted"))).toBe(true)
        expect(canTakeOut(order("preparing"))).toBe(true)
    })

    it("never before it is taken, after «Tayyor», or on the last line", () => {
        for (const status of ["pending", "ready", "picked_up", "delivered", "cancelled"]) {
            expect(canTakeOut(order(status))).toBe(false)
        }
        expect(canTakeOut(order("preparing", 1))).toBe(false)
    })
})
