import { beforeEach, describe, expect, it, vi } from "vitest"

import { useRouter } from "./router.js"

/** The page's scroll as the router sees it (node has no window). */
const page = { scrollY: 0 }

beforeEach(() => {
    page.scrollY = 0
    vi.stubGlobal("window", {
        get scrollY(): number {
            return page.scrollY
        },
        scrollTo: ({ top }: { top: number }): void => {
            page.scrollY = top
        },
    })
    vi.stubGlobal("requestAnimationFrame", (run: () => void): number => {
        run()
        return 0
    })
    useRouter.getState().start({ name: "menu" })
})

const names = (): string[] => useRouter.getState().stack.map((route) => route.name)

describe("router: back, forward, and where each screen was scrolled", () => {
    it("forward returns to the screen back just left, at its scroll", () => {
        const router = useRouter.getState()
        page.scrollY = 640
        router.push({ name: "cart" })
        expect(page.scrollY).toBe(0)
        page.scrollY = 120
        useRouter.getState().back()
        expect(names()).toEqual(["menu"])
        expect(page.scrollY).toBe(640)
        expect(useRouter.getState().direction).toBe("back")
        useRouter.getState().forward()
        expect(names()).toEqual(["menu", "cart"])
        expect(page.scrollY).toBe(120)
        expect(useRouter.getState().direction).toBe("forward")
    })

    it("a new move forgets what was ahead; forward with nothing ahead does nothing", () => {
        const router = useRouter.getState()
        router.push({ name: "cart" })
        useRouter.getState().back()
        useRouter.getState().push({ name: "orders" })
        expect(useRouter.getState().ahead).toEqual([])
        useRouter.getState().forward()
        expect(names()).toEqual(["menu", "orders"])
    })

    it("back on the first screen stays; reset keeps the root's place", () => {
        useRouter.getState().back()
        expect(names()).toEqual(["menu"])
        page.scrollY = 300
        useRouter.getState().push({ name: "cart" })
        useRouter.getState().reset({ name: "order", id: "o1" })
        useRouter.getState().back()
        expect(names()).toEqual(["menu"])
        expect(page.scrollY).toBe(300)
    })
})
