import { describe, expect, it } from "vitest"

import { cn } from "./cn.js"

describe("cn", () => {
    it("joins classes and drops falsy values", () => {
        expect(cn("a", false, undefined, "b", { c: true, d: false })).toBe("a b c")
    })
})
