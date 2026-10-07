import { describe, expect, it } from "vitest"

import { Language } from "@zumda/core"
import { dictionaryFor, errorText, registerStaff } from "./index.js"
import { staffUz } from "./staff.js"
import { uz } from "./uz.js"

/** The server's sources as text (Vite reads them at test time; tests are left out). */
const CORE = import.meta.glob<string>(
    ["../../../core/src/**/*.ts", "!../../../core/src/__tests__/**"],
    { query: "?raw", import: "default", eager: true },
)
const WORKER = import.meta.glob<string>("../../../worker/src/**/*.ts", {
    query: "?raw",
    import: "default",
    eager: true,
})

/** The codes the server can send the app: business rules, conflicts, its own API errors. */
function serverCodes(): Set<string> {
    const codes = new Set<string>()
    const add = (text: string, pattern: RegExp): void => {
        for (const match of text.matchAll(pattern)) {
            codes.add(match[1] ?? "")
        }
    }
    for (const [path, text] of Object.entries(CORE)) {
        add(text, /new BusinessRuleViolationError\(\s*"([A-Z_]+)"/g)
        add(text, /readonly code = "([A-Z_]+)"/g)
        if (path.endsWith("conflict.error.ts")) {
            add(text, /\| "([A-Z_]+)"/g)
        }
    }
    for (const text of Object.values(WORKER)) {
        add(text, /new ApiError\(\s*\d+,\s*"([A-Z_]+)"/g)
    }
    // The base class's code: the server always sends the rule instead.
    codes.delete("BUSINESS_RULE_VIOLATION")
    return codes
}

describe("error words", () => {
    it("every code the server sends has its own Uzbek sentence, never «Nimadir xato ketdi»", () => {
        const codes = serverCodes()
        const known = new Set([...Object.keys(uz.errors), ...Object.keys(staffUz.staffErrors)])
        expect([...codes].filter((code) => !known.has(code)).sort()).toEqual([])
        // The scan really read the server: dozens of codes, the new ones among them.
        expect(codes.size).toBeGreaterThan(40)
        expect(codes).toContain("DISTRICT_EXISTS")
        expect(codes).toContain("PAYMENT_METHOD_UNAVAILABLE")
    })

    it("staff error words join the customer's once the staff chunk loads", () => {
        expect(errorText(dictionaryFor(Language.UZ), "NOT_FOR_TRIP")).toBe(uz.errors.generic)
        registerStaff({ uz: staffUz })
        const t = dictionaryFor(Language.UZ)
        expect(errorText(t, "NOT_FOR_TRIP")).toBe(staffUz.staffErrors.NOT_FOR_TRIP)
        expect(errorText(t, "PHONE_REQUIRED")).toBe(uz.errors.PHONE_REQUIRED)
    })
})
