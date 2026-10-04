import { useEffect, useRef } from "react"
import { create } from "zustand"

interface RefreshEntry {
    /** Render order of the owner: a screen inside another one outranks it. */
    rank: number
    handler: { current: () => Promise<unknown> | unknown }
}

/** Everyone who can refresh now; a pull refreshes only the innermost (highest rank) one. */
const entries: RefreshEntry[] = []
let nextRank = 0

interface RefreshState {
    /** Some screen on view can refresh: the pull gesture is allowed. */
    available: boolean
    set(available: boolean): void
}

export const useRefreshStore = create<RefreshState>((set) => ({
    available: false,
    set: (available): void => set({ available }),
}))

function sync(): void {
    useRefreshStore.getState().set(entries.length > 0)
}

/** Refreshes the innermost screen; resolves when its data is back. */
export async function runRefresh(): Promise<void> {
    const top = entries.reduce<RefreshEntry | undefined>(
        (best, entry) => (!best || entry.rank > best.rank ? entry : best),
        undefined,
    )
    await top?.handler.current()
}

export function canRefresh(): boolean {
    return entries.length > 0
}

/**
 * A pull down from the top of this screen runs `onRefresh` (its data again, without clearing
 * what is on screen). Nested screens: the innermost one gets the pull.
 */
export function useRefresh(onRefresh: (() => Promise<unknown> | unknown) | null): void {
    const handler = useRef<() => Promise<unknown> | unknown>(() => undefined)
    handler.current = onRefresh ?? ((): void => undefined)
    const rank = useRef<number | null>(null)
    if (rank.current === null) {
        rank.current = nextRank++
    }
    const enabled = onRefresh !== null
    useEffect(() => {
        if (!enabled) {
            return undefined
        }
        const entry: RefreshEntry = { rank: rank.current ?? 0, handler }
        entries.push(entry)
        sync()
        return (): void => {
            entries.splice(entries.indexOf(entry), 1)
            sync()
        }
    }, [enabled])
}
