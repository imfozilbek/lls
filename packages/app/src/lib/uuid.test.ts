import { afterEach, describe, expect, it, vi } from "vitest"

import { uuid } from "./uuid.js"

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("uuid", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("uses the browser's own when it has one", () => {
        expect(uuid()).toMatch(V4)
    })

    it("an older web view without randomUUID still gets a valid v4 id", () => {
        vi.stubGlobal("crypto", {
            getRandomValues: (bytes: Uint8Array): Uint8Array => bytes.fill(0xff),
        })
        expect(uuid()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff")
        expect(uuid()).toMatch(V4)
    })
})
