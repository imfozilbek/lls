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

interface RouterState {
    stack: Route[]
    push(route: Route): void
    back(): void
    /** A different first screen, e.g. the showcase opening a shop. */
    start(route: Route): void
    /** Replace everything after the root, e.g. checkout → order without a way back to checkout. */
    reset(...routes: Route[]): void
}

/** A tiny stack router: Telegram's BackButton pops it. No URL routing needed inside a Mini App. */
export const useRouter = create<RouterState>((set, get) => ({
    stack: [{ name: "menu" }],
    push: (route): void => {
        set({ stack: [...get().stack, route] })
        window.scrollTo({ top: 0 })
    },
    back: (): void => {
        const { stack } = get()
        if (stack.length > 1) {
            set({ stack: stack.slice(0, -1) })
        }
    },
    start: (route): void => set({ stack: [route] }),
    reset: (...routes): void => {
        set({ stack: [get().stack[0] ?? { name: "menu" }, ...routes] })
        window.scrollTo({ top: 0 })
    },
}))

export function useCurrentRoute(): Route {
    return useRouter((state) => state.stack[state.stack.length - 1] ?? { name: "menu" })
}
