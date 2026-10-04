/**
 * Zumda's own map (served by the Worker from R2; the stand has a piece around Yakkabog').
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, resetStand } from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

test.describe.configure({ mode: "serial" })

test.describe("the map", () => {
    test.beforeAll(resetStand)

    test("checkout: the customer moves the map under the pin and picks the place", async ({
        page,
    }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
        await bottomButton(page).click()
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()

        await page.getByRole("button", { name: "Xaritada belgilash" }).click()
        const picker = page.getByRole("dialog", { name: "Joyni belgilang" })
        await expect(picker).toBeVisible()
        const map = picker.locator(".zumda-map")
        await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 })
        await expect(picker.locator('[data-marker="shop"]')).toBeVisible()
        await page.screenshot({ path: "screenshots/light/map-picker.png" })

        const box = await map.boundingBox()
        if (!box) {
            throw new Error("no map")
        }
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 60, {
            steps: 8,
        })
        await page.mouse.up()
        await picker.getByRole("button", { name: "Shu yer" }).click()
        await expect(picker).toBeHidden()
        await expect(page.getByRole("button", { name: /Joy belgilandi/ })).toBeVisible()
    })
})
