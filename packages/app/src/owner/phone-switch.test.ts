import { describe, expect, it } from "vitest"

import { phoneSwitchState } from "./phone-switch.js"

describe("«Raqamni mijozlarga ko'rsatmaslik»", () => {
    it("flips while the support group answers customers", () => {
        expect(phoneSwitchState(false, true)).toBe("available")
        expect(phoneSwitchState(true, true)).toBe("available")
    })

    it("without the group: first the group; a number hidden before is shown again", () => {
        expect(phoneSwitchState(false, false)).toBe("needsGroup")
        expect(phoneSwitchState(true, false)).toBe("groupLost")
    })
})
