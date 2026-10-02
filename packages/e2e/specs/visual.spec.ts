/**
 * Every main screen on a narrow phone (360 px), in Telegram's light and dark themes:
 * nothing sticks out sideways, and a screenshot is kept for a human look.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, WATER, placeOrder, resetStand } from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.use({ viewport: { width: 360, height: 780 } })
test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await resetStand()
    await placeOrder(PEOPLE.customer, FOOD, [{ productId: "dev-food-p1", quantity: 2 }], {
        landmark: "возле школы",
    })
})

async function snap(page: Page, name: string, theme: string): Promise<void> {
    await page.waitForTimeout(400) // entry animations
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow, `${name} is wider than the screen`).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `screenshots/${theme}/${name}.png`, fullPage: true })
}

for (const theme of ["light", "dark"] as const) {
    test(`customer screens, ${theme}`, async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme })
        await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
        await snap(page, "01-storefront", theme)
        await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
        await bottomButton(page).click()
        await snap(page, "02-cart", theme)
        await bottomButton(page).click()
        await snap(page, "03-checkout", theme)
        await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme })
        await page.getByRole("button", { name: "Мои заказы" }).click()
        await snap(page, "04-history", theme)
        await page.getByRole("button", { name: /Заказ #1/ }).click()
        await snap(page, "05-order", theme)
        await openApp(page, { user: PEOPLE.customer, shop: WATER, theme })
        await page.getByRole("button", { name: "Добавить: Toza suv 19 l" }).click()
        await bottomButton(page).click()
        await bottomButton(page).click()
        await snap(page, "06-water-checkout", theme)
    })

    test(`owner screens, ${theme}`, async ({ page }) => {
        await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, theme })
        await page.getByRole("button", { name: "Мой магазин" }).click()
        await expect(page.getByText("Заказ #1")).toBeVisible()
        await snap(page, "10-owner-orders", theme)
        await page.getByRole("tab", { name: "Меню" }).click()
        await snap(page, "11-owner-menu", theme)
        await page.getByRole("switch", { name: "В наличии: Lag'mon" }).click()
        await snap(page, "12-owner-stop-sheet", theme)
        await page.keyboard.press("Escape")
        await bottomButton(page).click()
        await snap(page, "13-owner-new-product", theme)
        await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, theme })
        await page.getByRole("button", { name: "Мой магазин" }).click()
        await page.getByRole("tab", { name: "Деньги" }).click()
        await snap(page, "14-owner-money", theme)
        await page.getByRole("tab", { name: "Настройки" }).click()
        await expect(page.getByText("Принимать заказы")).toBeVisible()
        await snap(page, "15-owner-settings", theme)
    })

    test(`courier, showcase and onboarding, ${theme}`, async ({ page }) => {
        await openApp(page, { user: PEOPLE.courier, courierBot: true, theme })
        await expect(page.getByRole("heading", { name: "Мои доставки" })).toBeVisible()
        await expect(page.getByText("Мои магазины")).toBeVisible()
        await snap(page, "20-courier", theme)
        await openApp(page, { user: PEOPLE.customer, query: "?mode=market", theme })
        await expect(page.getByText("Магазины · 2")).toBeVisible()
        await snap(page, "21-showcase", theme)
        await page.getByRole("textbox", { name: "Поиск товара" }).fill("ош")
        await expect(page.getByRole("button", { name: /To'y oshi/ })).toBeVisible()
        await snap(page, "22-showcase-search", theme)
        await openApp(page, { user: PEOPLE.newOwner, query: "?mode=onboarding", theme })
        await snap(page, "23-onboarding", theme)
        await bottomButton(page).click()
        await snap(page, "24-onboarding-step1", theme)
    })
}
