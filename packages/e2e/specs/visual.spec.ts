/**
 * Every main screen on a narrow phone (360 px): nothing sticks out sideways, and a screenshot is
 * kept for a human look. The app is always light (owner's decision), even in a dark Telegram.
 */
import { writeFileSync } from "node:fs"

import { expect, test } from "@playwright/test"

import { APP_URL } from "../stand/config.js"
import { pngImage } from "../support/images.js"
import { flatSurfaces, smallTargets } from "../support/look.js"
import { unreadableText } from "../support/readability.js"
import {
    FOOD,
    PEOPLE,
    STORE,
    WATER,
    apiAs,
    placeOrder,
    resetStand,
    payAndStart,
} from "../support/stand.js"
import { stubTelegramLogin } from "../support/telegram-login.js"
import { bottomButton, openApp, openSettings, pickOnMap, settingsBack } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.use({ viewport: { width: 360, height: 780 } })
test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await resetStand()
    await placeOrder(PEOPLE.customer, FOOD, [{ productId: "dev-food-p1", quantity: 2 }], {
        landmark: "maktab yonida",
    })
})

/** What a look at every screen found: kept beside the screenshots for a human review. */
const looks: { screen: string; flat: unknown[]; small: unknown[] }[] = []

test.afterAll(() => {
    writeFileSync("screenshots/look-report.json", `${JSON.stringify(looks, null, 2)}\n`)
})

async function snap(page: Page, name: string, theme: string): Promise<void> {
    await page.waitForTimeout(400) // entry animations
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow, `${name} is wider than the screen`).toBeLessThanOrEqual(0)
    // Every word on the screen is readable: AA contrast on its own surface, 13 px or more.
    expect(await unreadableText(page), `${name} has text that is hard to read`).toEqual([])
    // A card melting into what is under it, a target under 44 px: listed for the review.
    looks.push({ screen: name, flat: await flatSurfaces(page), small: await smallTargets(page) })
    await page.screenshot({ path: `screenshots/${theme}/${name}.png`, fullPage: true })
}

for (const theme of ["light"] as const) {
    test(`customer screens, ${theme}`, async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme })
        await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
        await snap(page, "01-storefront", theme)
        await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
        // The cart and the order are one screen: the lines, the phone, the place, the button.
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
        await snap(page, "02-cart", theme)
        await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme })
        await page.getByRole("button", { name: "Buyurtmalarim" }).click()
        await snap(page, "04-history", theme)
        await page.getByRole("button", { name: /Buyurtma #1/ }).click()
        await snap(page, "05-order", theme)
        await page.getByRole("button", { name: "Chekni yuklash" }).click()
        await page.locator('input[type="file"]').setInputFiles({
            name: "chek.png",
            mimeType: "image/png",
            buffer: pngImage(240, [236, 253, 245]),
        })
        await expect(page.getByRole("img", { name: "O'tkazma cheki" })).toBeVisible()
        await snap(page, "07-receipt-sheet", theme)
        await page.getByRole("button", { name: "O'tkazdim" }).click()
        await expect(page.getByRole("heading", { name: "Do'kon pulni tekshirmoqda" })).toBeVisible()
        await snap(page, "08-order-checking", theme)
        await openApp(page, { user: PEOPLE.customer, shop: WATER, theme })
        await page.getByRole("button", { name: "Qo'shish: Toza suv 19 l" }).click()
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
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
        // The location step opens by itself a moment later: no screenshot of a page in motion.
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
        await payAndStart(PEOPLE.foodOwner, FOOD, order.id)
        await openApp(page, { user: PEOPLE.networkCourier, courierBot: true, theme })
        await expect(page.getByRole("button", { name: "Olaman" }).first()).toBeVisible()
        await snap(page, "25-courier-nearby", theme)
        await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, theme })
        await page.getByRole("button", { name: "Mening do'konim" }).click()
        await expect(page.getByText("Tuman tarmog'idan kuryer qidirilmoqda").first()).toBeVisible()
        await snap(page, "26-owner-network-order", theme)
        // Taken: the courier's whole card, the shop and the customer's place.
        await openApp(page, { user: PEOPLE.networkCourier, courierBot: true, theme })
        await page.getByRole("button", { name: "Olaman" }).first().click()
        await expect(page.getByText("Navoiy 12").first()).toBeVisible()
        await snap(page, "33-courier-delivery", theme)
    })
}

/** Every part of «Sozlamalar», by its name in the list and the screenshot's. */
const SETTINGS_PARTS: readonly (readonly [string, string])[] = [
    ["Do'kon", "shop"],
    ["Vitrina qanday ko'rinadi", "look"],
    ["Yetkazib berish", "delivery"],
    ["Ish vaqti", "hours"],
    ["Manzil", "address"],
    ["To'lov", "payment"],
    ["Kuryerlar", "couriers"],
    ["Do'kon imkoniyatlari", "features"],
    ["Telegram kanal", "channel"],
    ["Mijozlar savollari", "support"],
    ["Havola, QR-kod va vitrina", "link"],
]

test("every part of «Sozlamalar», light", async ({ page }) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    for (const [index, [part, name]] of SETTINGS_PARTS.entries()) {
        await openSettings(page, part)
        await snap(page, `${60 + index}-settings-${name}`, "light")
        await settingsBack(page)
    }
})

test("the storefront's four looks under a cover, and a product up close, light", async ({
    page,
}) => {
    const cover = await apiAs(PEOPLE.storeOwner, "/owner/shop/cover", {
        shop: STORE,
        method: "PUT",
        png: pngImage(400, [190, 24, 93]),
    })
    expect(cover.status).toBe(200)
    for (const [index, layout] of ["grid", "list", "feed", "shelves"].entries()) {
        const saved = await apiAs(PEOPLE.storeOwner, "/owner/shop", {
            shop: STORE,
            method: "PATCH",
            json: { storefrontLayout: layout },
        })
        expect(saved.status).toBe(200)
        await openApp(page, { user: PEOPLE.customer, shop: STORE })
        await expect(page.getByRole("heading", { name: "Uy Bozori" })).toBeVisible()
        await snap(page, `${40 + index}-storefront-${layout}`, "light")
    }
    await page.getByRole("heading", { name: "LED lampochka" }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await snap(page, "44-product-sheet", "light")
})

test("«Platforma», light", async ({ page }) => {
    await openApp(page, { user: PEOPLE.admin, adminBot: true })
    await expect(page.getByRole("heading", { name: "Platforma" })).toBeVisible()
    await snap(page, "50-platforma-applications", "light")
    const tabs = [
        ["Bizneslar", "shops"],
        ["Tumanlar", "districts"],
        ["Qo'llanma", "guides"],
    ] as const
    for (const [index, [tab, name]] of tabs.entries()) {
        await page.getByRole("tab", { name: tab }).click()
        await snap(page, `${51 + index}-platforma-${name}`, "light")
    }
})

test("outside Telegram: the sign-in pages, then «Mening bizneslarim», light", async ({ page }) => {
    // A page of its own: no Telegram in it, as in a plain browser.
    await page.route("https://telegram.org/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
    )
    await stubTelegramLogin(page, () => ({ user: PEOPLE.foodOwner }))
    await page.goto(`${APP_URL}/?mode=admin`)
    await expect(page.getByRole("heading", { name: "Zumda | Platforma" })).toBeVisible()
    await snap(page, "54-platforma-web-login", "light")
    await page.goto(`${APP_URL}/?mode=business`)
    await expect(page.getByRole("heading", { name: "Zumda Business" })).toBeVisible()
    await snap(page, "55-business-web-login", "light")
    await page.getByRole("button", { name: "Telegram orqali kirish" }).click()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    await page.getByRole("button", { name: "Orqaga" }).click()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
    await snap(page, "56-my-businesses", "light")
})

test("a dark Telegram theme still shows the light app, framed in the page's gray", async ({
    page,
}) => {
    const app = await openApp(page, { user: PEOPLE.customer, shop: FOOD, theme: "dark" })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    const colors = await page.evaluate(() => {
        const body = getComputedStyle(document.body)
        return { background: body.backgroundColor, text: body.color }
    })
    expect(colors).toEqual({ background: "rgb(243, 244, 246)", text: "rgb(17, 24, 39)" })
    const painted = (await app.calls())
        .filter((c) => c.method === "setHeaderColor" || c.method === "setBackgroundColor")
        .map((c) => c.args[0])
    expect(painted).toEqual(["#f3f4f6", "#f3f4f6"])
})
