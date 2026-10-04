import { describe, expect, it } from "vitest"

import {
    PULL_MAX_PX,
    PULL_TRIGGER_PX,
    SWIPE_MAX_PX,
    classify,
    pullDistance,
    swipeDistance,
} from "./gesture.js"

const ALL = { canPull: true, canBack: true, canForward: true }
const NONE = { canPull: false, canBack: false, canForward: false }

describe("page gestures", () => {
    it("waits until the finger has moved enough to tell", () => {
        expect(classify(4, 6, ALL)).toBe("undecided")
    })

    it("down from the top pulls to refresh; up or a screen that cannot refresh does not", () => {
        expect(classify(3, 40, ALL)).toBe("pull")
        expect(classify(3, -40, ALL)).toBe("none")
        expect(classify(3, 40, { ...ALL, canPull: false })).toBe("none")
    })

    it("clearly sideways: right is back, left is forward, each only when it exists", () => {
        expect(classify(40, 5, ALL)).toBe("back")
        expect(classify(-40, 5, ALL)).toBe("forward")
        expect(classify(40, 5, { ...ALL, canBack: false })).toBe("none")
        expect(classify(-40, 5, { ...ALL, canForward: false })).toBe("none")
    })

    it("a diagonal is a scroll, never a swipe", () => {
        expect(classify(20, 30, ALL)).toBe("pull")
        expect(classify(30, 25, ALL)).toBe("none")
        expect(classify(30, -25, ALL)).toBe("none")
        expect(classify(20, 30, NONE)).toBe("none")
    })

    it("the pull feels like a spring and stops at its limit; the bubble too", () => {
        expect(pullDistance(2 * PULL_TRIGGER_PX)).toBe(PULL_TRIGGER_PX)
        expect(pullDistance(1000)).toBe(PULL_MAX_PX)
        expect(pullDistance(-50)).toBe(0)
        expect(swipeDistance(-50)).toBe(50)
        expect(swipeDistance(1000)).toBe(SWIPE_MAX_PX)
    })
})
