import { create } from "zustand"

export type Route =
    | { name: "menu" }
    | { name: "cart" }
    | { name: "checkout" }
    | { name: "order"; id: string; justPlaced?: boolean }
    | { name: "orders" }
    | { name: "owner" }
    /** Owner's product editor; `id: null` creates a new product. */
    | { name: "product"; id: string | null }

/** Which way the last move went: screens slide in from that side. */
export type Direction = "forward" | "back" | "none"

/** A screen left by "back", with where it was scrolled: "forward" brings both back. */
interface Ahead {
    route: Route
    scroll: number
}

interface RouterState {
    stack: Route[]
    /** Scroll position of each screen in `stack` when it was left (the top one: unused). */
    scrolls: number[]
    /** Screens "back" left behind, the nearest last. Any new move forgets them. */
    ahead: Ahead[]
    direction: Direction
    push(route: Route): void
    back(): void
    /** Returns to the screen "back" just left, if any. */
    forward(): void
    /** A different first screen, e.g. the showcase opening a shop. */
    start(route: Route): void
    /** Replace everything after the root, e.g. checkout → order without a way back to checkout. */
    reset(...routes: Route[]): void
}

/** Restores a scroll position once the screen has drawn (two frames: React, then layout). */
function scrollAfterRender(top: number): void {
    const go = (): void => window.scrollTo({ top })
    requestAnimationFrame(() => requestAnimationFrame(go))
}

/** A tiny stack router: Telegram's BackButton pops it. No URL routing needed inside a Mini App. */
export const useRouter = create<RouterState>((set, get) => ({
    stack: [{ name: "menu" }],
    scrolls: [0],
    ahead: [],
    direction: "none",
    push: (route): void => {
        const { stack, scrolls } = get()
        set({
            stack: [...stack, route],
            scrolls: [...scrolls.slice(0, stack.length - 1), window.scrollY, 0],
            ahead: [],
            direction: "forward",
        })
        window.scrollTo({ top: 0 })
    },
    back: (): void => {
        const { stack, scrolls, ahead } = get()
        const top = stack[stack.length - 1]
        if (stack.length <= 1 || !top) {
            return
        }
        set({
            stack: stack.slice(0, -1),
            scrolls: scrolls.slice(0, -1),
            ahead: [...ahead, { route: top, scroll: window.scrollY }],
            direction: "back",
        })
        scrollAfterRender(scrolls[stack.length - 2] ?? 0)
    },
    forward: (): void => {
        const { stack, scrolls, ahead } = get()
        const next = ahead[ahead.length - 1]
        if (!next) {
            return
        }
        set({
            stack: [...stack, next.route],
            scrolls: [...scrolls.slice(0, stack.length - 1), window.scrollY, next.scroll],
            ahead: ahead.slice(0, -1),
            direction: "forward",
        })
        scrollAfterRender(next.scroll)
    },
    start: (route): void => set({ stack: [route], scrolls: [0], ahead: [], direction: "none" }),
    reset: (...routes): void => {
        set({
            stack: [get().stack[0] ?? { name: "menu" }, ...routes],
            scrolls: [get().scrolls[0] ?? 0, ...routes.map(() => 0)],
            ahead: [],
            direction: "forward",
        })
        window.scrollTo({ top: 0 })
    },
}))

export function useCurrentRoute(): Route {
    return useRouter((state) => state.stack[state.stack.length - 1] ?? { name: "menu" })
}
