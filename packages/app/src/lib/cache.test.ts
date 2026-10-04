import { beforeEach, describe, expect, it } from "vitest"

import { cached, clearCache, firstShow, remember } from "./cache.js"

beforeEach(clearCache)

describe("session cache", () => {
    it("gives back what a screen loaded, by key", () => {
        expect(cached("orders")).toBeUndefined()
        expect(remember("orders", [1, 2])).toEqual([1, 2])
        expect(cached("orders")).toEqual([1, 2])
        expect(cached("other")).toBeUndefined()
    })

    it("a list rises in only the first time it is shown", () => {
        expect(firstShow("menu")).toBe(true)
        expect(firstShow("menu")).toBe(false)
        expect(firstShow("orders")).toBe(true)
    })
})
