import { create } from "zustand"

/**
 * Steps of «Ishga tayyor» the server cannot tell from the shop itself: «O'zim yetkazaman», or
 * hours confirmed as open around the clock (stored the same as never set). Kept on this phone.
 */
export type Tick = "selfDelivery" | "hours"

const PREFIX = "zumda."

/** Ticks of this session even when storage is blocked (private mode). */
const session = new Set<string>()

/** Bumped on every tick: each place showing one (the card on every tab, Sozlamalar) re-reads. */
const useTickVersion = create<{ version: number; bump(): void }>((set) => ({
    version: 0,
    bump: (): void => set((state) => ({ version: state.version + 1 })),
}))

function keyOf(tick: Tick, shopId: string): string {
    return `${PREFIX}${tick}.${shopId}`
}

export function readTick(tick: Tick, shopId: string): boolean {
    if (session.has(keyOf(tick, shopId))) {
        return true
    }
    try {
        return window.localStorage.getItem(keyOf(tick, shopId)) === "1"
    } catch {
        return false
    }
}

export function saveTick(tick: Tick, shopId: string): void {
    session.add(keyOf(tick, shopId))
    try {
        window.localStorage.setItem(keyOf(tick, shopId), "1")
    } catch {
        // Private mode: the tick lasts until the app closes.
    }
    useTickVersion.getState().bump()
}

/** The tick as it is now: a tick saved anywhere shows everywhere at once. */
export function useTick(tick: Tick, shopId: string | undefined): boolean {
    useTickVersion((state) => state.version)
    return shopId ? readTick(tick, shopId) : false
}
