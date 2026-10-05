import { describe, expect, it } from "vitest"

import { crashFacts, ownPlace, safeScreen } from "./crash-facts.js"
import { listenForCrashes } from "./crashes.js"

import type { CrashFacts } from "@zumda/core"

const ORIGIN = "https://app.zumda.shop"

function errorWithStack(message: string, stack: string, name = "TypeError"): Error {
    const error = new TypeError(message)
    error.name = name
    error.stack = stack
    return error
}

const OWN_STACK = [
    "TypeError: x",
    "    at telegram (https://telegram.org/js/telegram-web-app.js:1:2)",
    `    at render (${ORIGIN}/assets/index-BzyS0hWw.js?v=2:12:3456)`,
    `    at other (${ORIGIN}/assets/other.js:1:1)`,
].join("\n")

describe("crashFacts", () => {
    it("tells the class, a clean message, our own place and the screen", () => {
        const error = errorWithStack(
            "Cannot read 'phone' of +998 90 123 45 67 for Азиз Каримов",
            OWN_STACK,
        )
        expect(crashFacts(error, "error", "shop:checkout", ORIGIN)).toEqual({
            kind: "error",
            name: "TypeError",
            detail: "Cannot read 'phone' of for",
            where: "index-BzyS0hWw.js:12:3456",
            screen: "shop:checkout",
        })
    })

    it("a rejection with a string or an object: no class, nothing personal", () => {
        expect(crashFacts("user 8421 not found", "rejection", "courier", ORIGIN)).toMatchObject({
            name: "NonError",
            detail: "user not found",
            where: "",
        })
        expect(crashFacts({ phone: "+998" }, "rejection", "courier", ORIGIN).detail).toBe("")
    })

    it("only our own frames, only known screens", () => {
        expect(ownPlace("at x (https://telegram.org/a.js:1:2)", ORIGIN)).toBe("")
        expect(ownPlace(`at x (${ORIGIN}/src/ui/Cart.tsx?t=17:40:7)`, ORIGIN)).toBe("Cart.tsx:40:7")
        expect(safeScreen("shop:order")).toBe("shop:order")
        expect(safeScreen("Shop 12")).toBe("unknown")
    })
})

describe("listenForCrashes", () => {
    function fire(target: EventTarget, type: string, props: Record<string, unknown>): void {
        target.dispatchEvent(Object.assign(new Event(type), props))
    }

    it("each kind of crash once a session, at most five, never other sites' scripts", () => {
        const target = new EventTarget()
        const sent: CrashFacts[] = []
        const stop = listenForCrashes(
            () => "market",
            (f) => sent.push(f),
            target,
            ORIGIN,
        )
        const crash = errorWithStack("boom", OWN_STACK)
        fire(target, "error", { error: crash, message: "boom", filename: `${ORIGIN}/assets/a.js` })
        fire(target, "error", { error: crash, message: "boom", filename: `${ORIGIN}/assets/a.js` })
        expect(sent).toHaveLength(1)

        fire(target, "error", { message: "Script error.", filename: "" })
        fire(target, "error", { error: new Error("x"), filename: "https://telegram.org/t.js" })
        expect(sent).toHaveLength(1)

        for (const word of ["a", "b", "c", "d", "e", "f"]) {
            fire(target, "unhandledrejection", { reason: `failed ${word}` })
        }
        expect(sent).toHaveLength(5)
        expect(sent[1]).toMatchObject({ kind: "rejection", detail: "failed a", screen: "market" })

        stop()
        fire(target, "unhandledrejection", { reason: "after stop" })
        expect(sent).toHaveLength(5)
    })

    it("a failing sender never throws back into the page", () => {
        const target = new EventTarget()
        listenForCrashes(
            () => "web",
            () => {
                throw new Error("offline")
            },
            target,
            ORIGIN,
        )
        expect(() => fire(target, "unhandledrejection", { reason: "x" })).not.toThrow()
    })
})
