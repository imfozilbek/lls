import { describe, expect, it } from "vitest"

import { CRASH_LIMITS, safeCrashText } from "../../../domain/shared/crash-text.js"

describe("safeCrashText", () => {
    it("keeps the words of an error, drops a phone, an id and a Cyrillic name", () => {
        const text = safeCrashText(
            "Cannot read properties of undefined (reading 'phone') +998 90 123 45 67 id 84213 Азиз Каримов",
        )
        expect(text).toBe("Cannot read properties of undefined (reading 'phone') id")
        expect(text).not.toMatch(/\d|[А-я]/)
    })

    it("drops a bot token whole, not only its digits", () => {
        // secret-scan: fake (a made-up token shape)
        const text = safeCrashText("Bad token 123456789:AAHfake_TokenPart-forTestsOnly here")
        expect(text).toBe("Bad token here")
    })

    it("is never longer than the limit", () => {
        expect(safeCrashText("a ".repeat(500)).length).toBeLessThanOrEqual(CRASH_LIMITS.detail)
        expect(safeCrashText("abc def", 3)).toBe("abc")
    })
})
