/**
 * Every main screen on a narrow phone (360 px): nothing sticks out sideways, and a screenshot is
 * kept for a human look. The app is always light (owner's decision), even in a dark Telegram.
 */
import { expect, test } from "@playwright/test"

import { pngImage } from "../support/images.js"
import { unreadableText } from "../support/readability.js"
import {
    FOOD,
    PEOPLE,
    WATER,
    apiAs,
    placeOrder,
    resetStand,
    payAndAccept,
} from "../support/stand.js"
import { bottomButton, openApp, pickOnMap } from "../support/webapp.js"

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
    // Every word on the screen is readable: AA contrast on its own surface, 13 px or more.
    expect(await unreadableText(page), `${name} has text that is hard to read`).toEqual([])
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
        await page.getByRole("button", { name: "O'tkazdim" }).click()
        await page.locator('input[type="file"]').setInputFiles({
            name: "chek.png",
            mimeType: "image/png",
            buffer: pngImage(240, [236, 253, 245]),
        })
        await expect(page.getByRole("img", { name: "O'tkazma cheki" })).toBeVisible()
        await snap(page, "07-receipt-sheet", theme)
        await page.getByRole("button", { name: "Chekni yuborish" }).click()
        await expect(page.getByRole("heading", { name: "Do'kon pulni tekshirmoqda" })).toBeVisible()
        await snap(page, "08-order-checking", theme)
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
        await page.getByRole("button", { name: "Pul keldi, qabul qilish" }).click()
        await expect(page.getByRole("button", { name: "Chekni ko'rish" })).toBeVisible()
        await snap(page, "16-owner-check", theme)
        await page.getByRole("button", { name: "Yo'q, pul kelmadi" }).click()
        await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme })
        await page.getByRole("button", { name: "Buyurtmalarim" }).click()
        await page.getByRole("button", { name: /Buyurtma #1/ }).click()
        await expect(
            page.getByRole("heading", { name: "Do'kon pulni hali ko'rmadi" }),
        ).toBeVisible()
        await snap(page, "09-order-rejected", theme)
        await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, theme })
        await page.getByRole("button", { name: "Mening do'konim" }).click()
        await page.getByRole("tab", { name: "Menyu" }).click()
        await snap(page, "11-owner-menu", theme)
        await page.getByRole("button", { name: "Sotuvdan olish: Lag'mon" }).click()
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
        await expect(page.getByText("Do'konlar · 3")).toBeVisible()
        await snap(page, "21-showcase", theme)
        await page.getByRole("textbox", { name: "Mahsulot qidirish" }).fill("ош")
        await expect(page.getByRole("button", { name: /To'y oshi/ })).toBeVisible()
        await snap(page, "22-showcase-search", theme)
        await openApp(page, { user: PEOPLE.newOwner, businessBot: true, theme })
        await snap(page, "23-onboarding", theme)
        await bottomButton(page).click()
        await snap(page, "24-onboarding-step1", theme)
    })

    test(`a business and its bot from the Zumda bot, ${theme}`, async ({ page }) => {
        const owner = { id: 4201, first_name: "Kamola", language_code: "uz" }
        const app = { user: owner, businessBot: true, theme, version: "9.6" }
        await openApp(page, { ...app, createsBot: 777300400 })
        await bottomButton(page).click()
        await page.getByLabel("Biznes nomi").fill("Kamola Somsa")
        await page.getByRole("radio", { name: "Restoran" }).click()
        await snap(page, "27-business-step1", theme)
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Biznesingiz boti" })).toBeVisible()
        await snap(page, "28-bot-step", theme)
        await page.getByRole("button", { name: "Menda bot bor" }).click()
        await snap(page, "29-bot-token", theme)
        await page.getByRole("button", { name: "Botni Zumda orqali yaratish" }).click()
        await bottomButton(page).click()
        await expect(page.getByText("Bot yaratildi: @new_777300400_bot")).toBeVisible()
        await snap(page, "30-bot-created", theme)
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Biznes qayerda?" })).toBeVisible()
        await pickOnMap(page)
        await expect(page.getByRole("button", { name: /Joy belgilandi/ })).toBeVisible()
        await snap(page, "31-location-step", theme)
        await bottomButton(page).click() // «Ariza yuborish»
        // Straight into the new business: under review, and «Ishga tayyor».
        await expect(page.getByRole("region", { name: "Ishga tayyor" })).toBeVisible()
        await snap(page, "32-business-ready", theme)
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
