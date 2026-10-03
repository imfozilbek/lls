import { afterEach, describe, expect, it, vi } from "vitest"

import {
    LIGHT_SURFACE,
    canRequestChat,
    paintLightFrame,
    readLaunchParams,
    requestChat,
} from "./telegram.js"

import type { WebApp } from "./telegram.js"

const app = (startParam?: string): WebApp =>
    ({ initDataUnsafe: { start_param: startParam } }) as unknown as WebApp

describe("readLaunchParams", () => {
    it("reads the shop from the menu button URL", () => {
        expect(readLaunchParams(new URL("https://x.pages.dev/?shop=osh"), null)).toEqual({
            shop: "osh",
            business: false,
            courier: false,
            market: false,
        })
    })

    it("reads the shop from a startapp link", () => {
        const url = new URL("https://x.pages.dev/")
        expect(readLaunchParams(url, app("shop_osh-markaz")).shop).toBe("osh-markaz")
        expect(readLaunchParams(url, app("evil<script>")).shop).toBeNull()
    })

    it("detects «Mening bizneslarim» opened from Zumda Business, and the old onboarding link", () => {
        for (const mode of ["business", "onboarding"]) {
            const url = new URL(`https://x.pages.dev/?mode=${mode}`)
            expect(readLaunchParams(url, null)).toEqual({
                shop: null,
                business: true,
                courier: false,
                market: false,
            })
        }
    })

    it("the address decides on the real hosts: business., delivery., app.", () => {
        expect(readLaunchParams(new URL("https://business.zumda.shop/"), null)).toMatchObject({
            business: true,
            courier: false,
        })
        expect(readLaunchParams(new URL("https://delivery.zumda.shop/"), null)).toMatchObject({
            business: false,
            courier: true,
        })
        expect(readLaunchParams(new URL("https://app.zumda.shop/?shop=osh"), null)).toMatchObject({
            shop: "osh",
            business: false,
            courier: false,
        })
    })

    it("detects the Zumda showcase opened from the Zumda bot", () => {
        const url = new URL("https://x.pages.dev/?mode=market")
        expect(readLaunchParams(url, null)).toMatchObject({ shop: null, market: true })
    })

    it("detects the courier mode opened from the shop bot", () => {
        const url = new URL("https://x.pages.dev/?shop=osh&mode=courier")
        expect(readLaunchParams(url, null)).toEqual({
            shop: "osh",
            business: false,
            courier: true,
            market: false,
        })
    })
})

describe("paintLightFrame", () => {
    function client(version: string): { app: WebApp; painted: string[] } {
        const painted: string[] = []
        const [major = 0, minor = 0] = version.split(".").map(Number)
        const app = {
            isVersionAtLeast: (wanted: string): boolean => {
                const [wMajor = 0, wMinor = 0] = wanted.split(".").map(Number)
                return major > wMajor || (major === wMajor && minor >= wMinor)
            },
            setHeaderColor: (color: string): void => void painted.push(`header ${color}`),
            setBackgroundColor: (color: string): void => void painted.push(`background ${color}`),
            setBottomBarColor: (color: string): void => void painted.push(`bottom ${color}`),
        } as unknown as WebApp
        return { app, painted }
    }

    it("paints Telegram's header, background and bottom bar white, even in a dark theme", () => {
        const { app, painted } = client("8.0")
        paintLightFrame(app)
        expect(painted).toEqual([
            `header ${LIGHT_SURFACE}`,
            `background ${LIGHT_SURFACE}`,
            `bottom ${LIGHT_SURFACE}`,
        ])
    })

    it("older clients get what they support; outside Telegram nothing happens", () => {
        const { app, painted } = client("7.0")
        paintLightFrame(app)
        expect(painted).toEqual([`header ${LIGHT_SURFACE}`, `background ${LIGHT_SURFACE}`])
        expect(() => paintLightFrame(null)).not.toThrow()
    })
})

describe("requestChat (Managed Bots: the «create a bot» window)", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    function telegram(version: string, created?: boolean): { calls: string[] } {
        const calls: string[] = []
        const webApp = {
            initData: "signed",
            isVersionAtLeast: (wanted: string): boolean => Number(version) >= Number(wanted),
            requestChat:
                created === undefined
                    ? undefined
                    : (id: string, done: (shared: boolean) => void): void => {
                          calls.push(id)
                          done(created)
                      },
        }
        vi.stubGlobal("window", { Telegram: { WebApp: webApp } })
        return { calls }
    }

    it("opens the prepared window on Telegram 9.6+ and tells whether the bot was created", async () => {
        const { calls } = telegram("9.6", true)
        expect(canRequestChat()).toBe(true)
        expect(await requestChat("prepared-1")).toBe(true)
        expect(calls).toEqual(["prepared-1"])
        telegram("9.6", false)
        expect(await requestChat("prepared-2")).toBe(false)
    })

    it("older Telegram apps and the browser fall back to the link", async () => {
        const { calls } = telegram("8.0", true)
        expect(canRequestChat()).toBe(false)
        expect(await requestChat("prepared-1")).toBe(false)
        expect(calls).toEqual([])
        telegram("9.6")
        expect(canRequestChat()).toBe(false)
        vi.stubGlobal("window", {})
        expect(canRequestChat()).toBe(false)
    })
})
