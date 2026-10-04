/**
 * Steps of «Ishga tayyor» the server cannot tell from the shop itself: «O'zim yetkazaman», or
 * hours confirmed as open around the clock (stored the same as never set). Kept on this phone.
 */
export type Tick = "selfDelivery" | "hours"

const PREFIX = "zumda."

export function readTick(tick: Tick, shopId: string): boolean {
    try {
        return window.localStorage.getItem(`${PREFIX}${tick}.${shopId}`) === "1"
    } catch {
        return false
    }
}

export function saveTick(tick: Tick, shopId: string): void {
    try {
        window.localStorage.setItem(`${PREFIX}${tick}.${shopId}`, "1")
    } catch {
        // Private mode: the tick lasts until the app closes.
    }
}
