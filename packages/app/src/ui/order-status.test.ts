import { OrderStatus } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { stageState } from "./order-status.js"

/** The customer's stages: 0 sent or paid, 1 being made, 2 on the way, 3 delivered. */
describe("the customer's timeline", () => {
    it("accepted, not started: the first stage is done and the work is next, not under way", () => {
        expect(stageState(0, 1, OrderStatus.ACCEPTED)).toBe("done")
        expect(stageState(1, 1, OrderStatus.ACCEPTED)).toBe("todo")
        // Once started, the work is under way.
        expect(stageState(1, 1, OrderStatus.PREPARING)).toBe("current")
        expect(stageState(1, 1, OrderStatus.READY)).toBe("current")
    })

    it("delivered is all done; a cancelled order has nothing under way", () => {
        expect(stageState(3, 3, OrderStatus.DELIVERED)).toBe("done")
        expect(stageState(0, -1, OrderStatus.CANCELLED)).toBe("todo")
    })
})
