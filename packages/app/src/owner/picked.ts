import { useMemo } from "react"
import { create } from "zustand"

/**
 * The lines the owner ticked while collecting (owner's decision, November 2026). Kept on this
 * phone, like the ticks of «Ishga tayyor»: on the server each tick would cost a request and a
 * row written. They outlive a closed app; another phone does not see them.
 */
const PREFIX = "zumda.picked."

/** An order is long collected after two days: its ticks go. */
export const PICKED_KEEP_MS = 2 * 24 * 60 * 60 * 1000

interface Stored {
    lines: number[]
    /** When the last tick was set: the age the clean-up goes by. */
    at: number
}

/** This session's ticks even when storage is blocked (private mode). */
const session = new Map<string, Stored>()

/** Bumped on every tick: both copies of one order (the list, «Xabardan») re-read. */
const usePickedVersion = create<{ version: number; bump(): void }>((set) => ({
    version: 0,
    bump: (): void => set((state) => ({ version: state.version + 1 })),
}))

let pruned = false

function storage(): Storage | null {
    try {
        return window.localStorage
    } catch {
        return null
    }
}

function parse(raw: string | null): Stored | null {
    try {
        const value = JSON.parse(raw ?? "null") as Partial<Stored> | null
        if (!value || typeof value.at !== "number" || !Array.isArray(value.lines)) {
            return null
        }
        const lines = value.lines.filter((line) => Number.isInteger(line) && line >= 0)
        return { lines, at: value.at }
    } catch {
        return null
    }
}

/** Drops the ticks of orders collected long ago, once a session. */
export function prunePicked(now = Date.now()): void {
    pruned = true
    const store = storage()
    if (!store) {
        return
    }
    try {
        const stale: string[] = []
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i)
            if (key?.startsWith(PREFIX)) {
                const stored = parse(store.getItem(key))
                if (!stored || now - stored.at > PICKED_KEEP_MS) {
                    stale.push(key)
                }
            }
        }
        stale.forEach((key) => store.removeItem(key))
    } catch {
        // Storage went away mid-way: the next session tries again.
    }
}

function read(orderId: string): Stored | null {
    const key = PREFIX + orderId
    const kept = session.get(key)
    if (kept) {
        return kept
    }
    try {
        return parse(storage()?.getItem(key) ?? null)
    } catch {
        return null
    }
}

/** The lines ticked on this phone. */
export function readPicked(orderId: string, now = Date.now()): ReadonlySet<number> {
    if (!pruned) {
        prunePicked(now)
    }
    const stored = read(orderId)
    return new Set(stored && now - stored.at <= PICKED_KEEP_MS ? stored.lines : [])
}

/** Ticks a line, or takes the tick off. */
export function togglePicked(orderId: string, line: number, now = Date.now()): void {
    const lines = new Set(readPicked(orderId, now))
    if (lines.has(line)) {
        lines.delete(line)
    } else {
        lines.add(line)
    }
    const key = PREFIX + orderId
    const stored: Stored = { lines: [...lines].sort((a, b) => a - b), at: now }
    session.set(key, stored)
    try {
        const store = storage()
        if (stored.lines.length) {
            store?.setItem(key, JSON.stringify(stored))
        } else {
            store?.removeItem(key)
        }
    } catch {
        // Private mode or a full storage: the ticks last until the app closes.
    }
    usePickedVersion.getState().bump()
}

/** The order's ticks as they are now: a tick on one copy of the card shows on the other. */
export function usePicked(orderId: string): ReadonlySet<number> {
    const version = usePickedVersion((state) => state.version)
    return useMemo(() => readPicked(orderId), [orderId, version])
}
