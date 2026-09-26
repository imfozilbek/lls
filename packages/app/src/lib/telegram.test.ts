import { describe, expect, it } from "vitest"

import { readLaunchParams } from "./telegram.js"

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
