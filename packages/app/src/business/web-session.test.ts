import { afterEach, describe, expect, it, vi } from "vitest"

import { clearSession, loadSession, saveSession } from "./web-session.js"

function storage(): Map<string, string> {
    const items = new Map<string, string>()
    vi.stubGlobal("window", {
        localStorage: {
            getItem: (key: string) => items.get(key) ?? null,
            setItem: (key: string, value: string) => items.set(key, value),
            removeItem: (key: string) => items.delete(key),
        },
    })
    return items
}

const SESSION = {
    token: "payload.signature",
    expiresAt: "2026-11-02T00:00:00.000Z",
    user: { id: 1001, firstName: "Rustam" },
}

describe("the browser keeps its Zumda | Business sign-in", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("saves, loads until it expires, and clears", () => {
        storage()
        saveSession(SESSION)
        expect(loadSession("business", Date.parse("2026-10-03T00:00:00Z"))).toEqual(SESSION)
        expect(loadSession("business", Date.parse("2026-11-03T00:00:00Z"))).toBeNull()
        clearSession()
        expect(loadSession("business", Date.parse("2026-10-03T00:00:00Z"))).toBeNull()
    })

    it("«Platforma» keeps its own sign-in, apart from Zumda | Business", () => {
        const items = storage()
        const at = Date.parse("2026-10-03T00:00:00Z")
        saveSession(SESSION, "admin")
        expect(loadSession("admin", at)).toEqual(SESSION)
        expect(loadSession("business", at)).toBeNull()
        expect([...items.keys()]).toEqual(["zumda.platform.session"])
        clearSession("business")
        expect(loadSession("admin", at)).toEqual(SESSION)
        clearSession("admin")
        expect(loadSession("admin", at)).toBeNull()
    })

    it("without storage (private mode) there is simply no saved sign-in", () => {
        vi.stubGlobal("window", {
            localStorage: {
                getItem: () => {
                    throw new Error("blocked")
                },
                setItem: () => {
                    throw new Error("blocked")
                },
                removeItem: () => {
                    throw new Error("blocked")
                },
            },
        })
        expect(() => saveSession(SESSION)).not.toThrow()
        expect(loadSession()).toBeNull()
        expect(() => clearSession()).not.toThrow()
    })

    it("a broken saved value is ignored", () => {
        storage().set("zumda.business.session", "{not json")
        expect(loadSession()).toBeNull()
    })
})
