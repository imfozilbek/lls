import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DeadlineExceeded, settleWithin } from "./deadline.js"

describe("settleWithin", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("lets the waiter go when the work never ends", async () => {
        const result = settleWithin(new Promise(() => undefined), 1000).catch((e: unknown) => e)
        await vi.advanceTimersByTimeAsync(999)
        expect(vi.getTimerCount()).toBe(1)
        await vi.advanceTimersByTimeAsync(1)
        await expect(result).resolves.toBeInstanceOf(DeadlineExceeded)
    })

    it("passes on the work's answer and its failure, and leaves no timer", async () => {
        await expect(settleWithin(Promise.resolve(7), 1000)).resolves.toBe(7)
        await expect(settleWithin(Promise.reject(new Error("no")), 1000)).rejects.toThrow("no")
        expect(vi.getTimerCount()).toBe(0)
    })
})
