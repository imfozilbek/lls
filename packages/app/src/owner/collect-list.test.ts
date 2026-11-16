import { BusinessType } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { isCollecting, ticksOn, unpickedBeforeReady } from "./collect-list.js"

import type { OrderDTO } from "@zumda/core"

/** Plain strings, as the server sends them; lines 0..n-1. */
function order(status: string, lines = 4): OrderDTO {
    return {
        id: "order-1",
        status,
        items: Array.from({ length: lines }, (_, line) => ({ line, name: `Mahsulot ${line}` })),
    } as unknown as OrderDTO
}

describe("collecting from the card (owner's decision, November 2026)", () => {
    it("every line shows in «Yig'ish kerak» and while it is collected, not before or after", () => {
        expect(isCollecting(order("accepted"))).toBe(true)
        expect(isCollecting(order("preparing"))).toBe(true)
        for (const status of ["pending", "ready", "picked_up", "delivered", "cancelled"]) {
            expect(isCollecting(order(status))).toBe(false)
        }
    })

    it("ticks once collecting started, never for a service", () => {
        expect(ticksOn(order("preparing"), BusinessType.GROCERY)).toBe(true)
        expect(ticksOn(order("preparing"), BusinessType.FOOD)).toBe(true)
        expect(ticksOn(order("preparing"), BusinessType.STORE)).toBe(true)
        expect(ticksOn(order("accepted"), BusinessType.GROCERY)).toBe(false)
        expect(ticksOn(order("preparing"), BusinessType.SERVICE)).toBe(false)
    })

    it("«Tayyor» asks only while ticks are in use and some line is left", () => {
        const four = order("preparing")
        expect(unpickedBeforeReady(four, new Set())).toBeNull()
        expect(unpickedBeforeReady(four, new Set([0, 2]))).toBe(2)
        expect(unpickedBeforeReady(four, new Set([0, 1, 2, 3]))).toBeNull()
    })

    it("a line taken out with «Yo'q» is not counted, nor its old tick", () => {
        // Line 3 was taken out: the order keeps lines 0..2; its tick stays on the phone.
        const three = order("preparing", 3)
        expect(unpickedBeforeReady(three, new Set([0, 1, 2]))).toBeNull()
        expect(unpickedBeforeReady(three, new Set([3]))).toBeNull()
        expect(unpickedBeforeReady(three, new Set([1, 3]))).toBe(2)
    })
})
