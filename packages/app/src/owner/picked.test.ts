import { afterEach, describe, expect, it, vi } from "vitest"

import type * as Picked from "./picked.js"

const NOW = Date.parse("2026-11-16T09:00:00Z")

function memoryStorage(): Storage {
    const data = new Map<string, string>()
    return {
        get length(): number {
            return data.size
        },
        key: (index: number): string | null => [...data.keys()][index] ?? null,
        getItem: (key: string): string | null => data.get(key) ?? null,
        setItem: (key: string, value: string): void => void data.set(key, String(value)),
        removeItem: (key: string): void => void data.delete(key),
        clear: (): void => data.clear(),
    }
}

/** The module as a newly opened app sees it: nothing in memory, only what the phone kept. */
async function openApp(): Promise<typeof Picked> {
    vi.resetModules()
    return import("./picked.js")
}

const lines = (set: ReadonlySet<number>): number[] => [...set].sort((a, b) => a - b)

describe("ticks while collecting, kept on this phone (owner's decision, November 2026)", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("stay after the app is closed and opened again", async () => {
        const storage = memoryStorage()
        vi.stubGlobal("window", { localStorage: storage })
        const first = await openApp()
        first.togglePicked("order-1", 2, NOW)
        first.togglePicked("order-1", 0, NOW)
        expect(lines(first.readPicked("order-1", NOW))).toEqual([0, 2])

        const again = await openApp()
        expect(lines(again.readPicked("order-1", NOW))).toEqual([0, 2])
        expect(lines(again.readPicked("order-2", NOW))).toEqual([])
    })

    it("a second tap takes the tick off; an order with none keeps nothing", async () => {
        const storage = memoryStorage()
        vi.stubGlobal("window", { localStorage: storage })
        const picked = await openApp()
        picked.togglePicked("order-1", 1, NOW)
        picked.togglePicked("order-1", 1, NOW)
        expect(lines(picked.readPicked("order-1", NOW))).toEqual([])
        expect(storage.length).toBe(0)
    })

    it("two days later they are gone, and the phone keeps no trace", async () => {
        const storage = memoryStorage()
        vi.stubGlobal("window", { localStorage: storage })
        ;(await openApp()).togglePicked("order-1", 0, NOW)
        const later = NOW + (await openApp()).PICKED_KEEP_MS + 1
        expect(lines((await openApp()).readPicked("order-1", later))).toEqual([])
        expect(storage.length).toBe(0)
    })

    it("a broken entry reads as no ticks", async () => {
        const storage = memoryStorage()
        storage.setItem("zumda.picked.order-1", "{oops")
        storage.setItem(
            "zumda.picked.order-2",
            JSON.stringify({ lines: [1, -1, 2.5, "x"], at: NOW }),
        )
        vi.stubGlobal("window", { localStorage: storage })
        const picked = await openApp()
        expect(lines(picked.readPicked("order-1", NOW))).toEqual([])
        expect(lines(picked.readPicked("order-2", NOW))).toEqual([1])
    })

    it("with the storage blocked (private mode) they last the session", async () => {
        vi.stubGlobal("window", {
            get localStorage(): Storage {
                throw new Error("blocked")
            },
        })
        const picked = await openApp()
        picked.togglePicked("order-1", 3, NOW)
        expect(lines(picked.readPicked("order-1", NOW))).toEqual([3])
    })
})
