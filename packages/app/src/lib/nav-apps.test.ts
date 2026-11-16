import { describe, expect, it } from "vitest"

import { NavApp } from "@zumda/core"

import { NAV_APPS, navAppsFor } from "./nav-apps.js"

const DOOR = { latitude: 38.9712, longitude: 66.6904 }
const NEXT = { latitude: 38.9655, longitude: 66.7011 }

describe("the navigation apps of a route", () => {
    it("five apps for one point, in their order until one is picked", () => {
        expect(navAppsFor([DOOR], null).map((entry) => entry.app.name)).toEqual([
            "Yandex Navigator",
            "Yandex Go",
            "Google Maps",
            "2GIS",
            "Yandex Maps",
        ])
    })

    it("the app picked last comes first", () => {
        expect(navAppsFor([DOOR], NavApp.GOOGLE).map((entry) => entry.app.id)).toEqual([
            NavApp.GOOGLE,
            NavApp.NAVIGATOR,
            NavApp.YANDEX_GO,
            NavApp.TWO_GIS,
            NavApp.YANDEX_MAPS,
        ])
        // An app this route cannot take stays out, wherever it stood.
        expect(navAppsFor([DOOR, NEXT], NavApp.YANDEX_GO).map((entry) => entry.app.id)).toEqual([
            NavApp.NAVIGATOR,
            NavApp.GOOGLE,
            NavApp.YANDEX_MAPS,
        ])
    })

    it("each app has its own id and icon", () => {
        const ids = NAV_APPS.map((app) => app.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const app of NAV_APPS) {
            expect(app.icon).toMatch(new RegExp(`nav-apps/${app.id}\\.webp$`))
        }
    })
})
