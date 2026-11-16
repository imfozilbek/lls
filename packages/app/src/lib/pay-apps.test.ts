import { describe, expect, it } from "vitest"

import { PAY_APPS } from "./pay-apps.js"

describe("the bank apps after «Raqamni nusxalash»", () => {
    it("Payme first; each app opens at the address the app itself claims", () => {
        expect(PAY_APPS.map((app) => [app.name, app.url])).toEqual([
            ["Payme", "https://payme.uz/openapp"],
            ["Click", "https://my.click.uz/app/transfers"],
            ["Uzum Bank", "https://uzumbank.uz/goto"],
            ["Paynet", "https://app.paynet.uz/"],
        ])
    })

    it("gives every app its own icon and id", () => {
        const ids = PAY_APPS.map((app) => app.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const app of PAY_APPS) {
            expect(app.icon).toMatch(new RegExp(`pay-apps/${app.id}\\.webp$`))
        }
    })
})
