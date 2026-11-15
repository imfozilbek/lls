import { describe, expect, it } from "vitest"

import { shownStages, stageCounts, stageOf } from "./order-stage.js"

import type { OrderDTO } from "@zumda/core"

/** Plain strings, as the server sends them. */
function order(status: string): OrderDTO {
    return { status } as unknown as OrderDTO
}

describe("the owner's order stages", () => {
    it("new, to collect, in work, ready, on the way; nothing for a finished order", () => {
        expect(stageOf(order("pending"))).toBe("new")
        expect(stageOf(order("accepted"))).toBe("queue")
        expect(stageOf(order("preparing"))).toBe("work")
        expect(stageOf(order("ready"))).toBe("ready")
        expect(stageOf(order("picked_up"))).toBe("road")
        expect(stageOf(order("delivered"))).toBeNull()
        expect(stageOf(order("cancelled"))).toBeNull()
    })

    it("counts each stage and shows chips only when the orders are in two stages or more", () => {
        const counts = stageCounts(
            ["pending", "pending", "accepted", "preparing", "ready"].map(order),
        )
        expect(counts).toEqual({ new: 2, queue: 1, work: 1, ready: 1, road: 0 })
        expect(shownStages(counts)).toEqual(["new", "queue", "work", "ready"])
        expect(shownStages(stageCounts([order("pending"), order("pending")]))).toEqual([])
    })
})
