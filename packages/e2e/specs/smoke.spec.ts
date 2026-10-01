import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, resetStand } from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

test.beforeAll(resetStand)

test("the storefront opens from the shop bot", async ({ page }) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
    await expect(bottomButton(page)).toContainText("Корзина · 1")
})
