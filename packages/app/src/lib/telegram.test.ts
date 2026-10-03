import { describe, expect, it } from "vitest"

import { LIGHT_SURFACE, paintLightFrame, readLaunchParams } from "./telegram.js"

import type { WebApp } from "./telegram.js"

const app = (startParam?: string): WebApp =>
    ({ initDataUnsafe: { start_param: startParam } }) as unknown as WebApp

describe("readLaunchParams", () => {
    it("reads the shop from the menu button URL", () => {
        expect(readLaunchParams(new URL("https://x.pages.dev/?shop=osh"), null)).toEqual({
            shop: "osh",
            onboarding: false,
            courier: false,
            market: false,
        })
    })

    it("reads the shop from a startapp link", () => {
        const url = new URL("https://x.pages.dev/")
        expect(readLaunchParams(url, app("shop_osh-markaz")).shop).toBe("osh-markaz")
        expect(readLaunchParams(url, app("evil<script>")).shop).toBeNull()
    })

    it("detects the onboarding mode of the platform bot", () => {
        const url = new URL("https://x.pages.dev/?mode=onboarding")
        expect(readLaunchParams(url, null)).toEqual({
            shop: null,
            onboarding: true,
            courier: false,
            market: false,
        })
    })

    it("detects the LLS showcase opened from the LLS bot", () => {
        const url = new URL("https://x.pages.dev/?mode=market")
        expect(readLaunchParams(url, null)).toMatchObject({ shop: null, market: true })
    })

    it("detects the courier mode opened from the shop bot", () => {
        const url = new URL("https://x.pages.dev/?shop=osh&mode=courier")
        expect(readLaunchParams(url, null)).toEqual({
            shop: "osh",
            onboarding: false,
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
