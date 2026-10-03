/**
 * Every main screen on a narrow phone (360 px): nothing sticks out sideways, and a screenshot is
 * kept for a human look. The app is always light (owner's decision), even in a dark Telegram.
 */
import { expect, test } from "@playwright/test"

import {
    FOOD,
    PEOPLE,
    WATER,
    apiAs,
    placeOrder,
    resetStand,
    payAndAccept,
} from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.use({ viewport: { width: 360, height: 780 } })
test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await resetStand()
    await placeOrder(PEOPLE.customer, FOOD, [{ productId: "dev-food-p1", quantity: 2 }], {
        landmark: "maktab yonida",
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

for (const theme of ["light"] as const) {
    test(`customer screens, ${theme}`, async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme })
        await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
        await snap(page, "01-storefront", theme)
        await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
        await bottomButton(page).click()
        await snap(page, "02-cart", theme)
        await bottomButton(page).click()
        await snap(page, "03-checkout", theme)
        await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme })
        await page.getByRole("button", { name: "Buyurtmalarim" }).click()
        await snap(page, "04-history", theme)
        await page.getByRole("button", { name: /Buyurtma #1/ }).click()
        await snap(page, "05-order", theme)
        await openApp(page, { user: PEOPLE.customer, shop: WATER, theme })
        await page.getByRole("button", { name: "Qo'shish: Toza suv 19 l" }).click()
        await bottomButton(page).click()
        await bottomButton(page).click()
        await snap(page, "06-water-checkout", theme)
    })

    test(`owner screens, ${theme}`, async ({ page }) => {
        await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, theme })
        await page.getByRole("button", { name: "Mening do'konim" }).click()
        await expect(page.getByText("Buyurtma #1")).toBeVisible()
        await snap(page, "10-owner-orders", theme)
        await page.getByRole("tab", { name: "Menyu" }).click()
        await snap(page, "11-owner-menu", theme)
        await page.getByRole("switch", { name: "Sotuvda bor: Lag'mon" }).click()
        await snap(page, "12-owner-stop-sheet", theme)
        await page.keyboard.press("Escape")
        await bottomButton(page).click()
        await snap(page, "13-owner-new-product", theme)
        await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, theme })
        await page.getByRole("button", { name: "Mening do'konim" }).click()
        await page.getByRole("tab", { name: "Pul" }).click()
        await snap(page, "14-owner-money", theme)
        await page.getByRole("tab", { name: "Sozlamalar" }).click()
        await expect(page.getByText("Buyurtma qabul qilish")).toBeVisible()
        await snap(page, "15-owner-settings", theme)
    })

    test(`courier, showcase and onboarding, ${theme}`, async ({ page }) => {
        await openApp(page, { user: PEOPLE.courier, courierBot: true, theme })
        await expect(page.getByRole("heading", { name: "Yetkazishlarim" })).toBeVisible()
        await expect(page.getByText("Do'konlarim")).toBeVisible()
        await snap(page, "20-courier", theme)
        await openApp(page, { user: PEOPLE.customer, query: "?mode=market", theme })
        await expect(page.getByText("Do'konlar · 2")).toBeVisible()
        await snap(page, "21-showcase", theme)
        await page.getByRole("textbox", { name: "Mahsulot qidirish" }).fill("ош")
        await expect(page.getByRole("button", { name: /To'y oshi/ })).toBeVisible()
        await snap(page, "22-showcase-search", theme)
        await openApp(page, { user: PEOPLE.newOwner, query: "?mode=onboarding", theme })
        await snap(page, "23-onboarding", theme)
        await bottomButton(page).click()
        await snap(page, "24-onboarding-step1", theme)
    })

    test(`district network, ${theme}`, async ({ page }) => {
        // Jasur is off today: the accepted order goes to the district network.
        await apiAs(PEOPLE.foodOwner, "/owner/couriers/dev-food-courier", {
            shop: FOOD,
            method: "PATCH",
            json: { offToday: true },
        })
        const order = await placeOrder(PEOPLE.customer, FOOD, [
            { productId: "dev-food-p1", quantity: 2 },
        ])
        await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)
        await openApp(page, { user: PEOPLE.networkCourier, courierBot: true, theme })
        await expect(page.getByRole("button", { name: "Olaman" }).first()).toBeVisible()
        await snap(page, "25-courier-nearby", theme)
        await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, theme })
        await page.getByRole("button", { name: "Mening do'konim" }).click()
        await expect(page.getByText("Tuman tarmog'idan kuryer qidirilmoqda").first()).toBeVisible()
        await snap(page, "26-owner-network-order", theme)
    })
}

test("a dark Telegram theme still shows the light app, framed in white", async ({ page }) => {
    const app = await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme: "dark" })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    const colors = await page.evaluate(() => {
        const body = getComputedStyle(document.body)
        return { background: body.backgroundColor, text: body.color }
    })
    expect(colors).toEqual({ background: "rgb(255, 255, 255)", text: "rgb(17, 24, 39)" })
    const painted = (await app.calls())
        .filter((c) => c.method === "setHeaderColor" || c.method === "setBackgroundColor")
        .map((c) => c.args[0])
    expect(painted).toEqual(["#ffffff", "#ffffff"])
})
