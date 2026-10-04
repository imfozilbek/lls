/**
 * The shop owner, the shop: catalog with photos and the stop-list, settings and logo, couriers,
 * the water shop's bottles.
 */
import { expect, test } from "@playwright/test"

import { shopBySlug } from "../stand/config.js"
import { pngImage } from "../support/images.js"
import { FOOD, PEOPLE, SERVICE, WATER, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { courierChat, lastSeq, shopChat, waitForCall, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp, openGroup, openSettings, settingsBack } from "../support/webapp.js"

import type { OpenedApp } from "../support/webapp.js"
import type { Page } from "@playwright/test"

async function openOwner(page: Page, options: { native?: boolean } = {}): Promise<OpenedApp> {
    const app = await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, ...options })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    return app
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("catalog: add a product with a photo; customers see it at once", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Menyu" }).click()
    await expect(page.getByText("To'y oshi")).toBeVisible()
    await bottomButton(page).click() // «Добавить товар»
    await expect(page.getByRole("heading", { name: "Yangi mahsulot" })).toBeVisible()
    // No dead button: an empty form says what to write first.
    await bottomButton(page).click()
    await expect(page.getByText("Mahsulot nomini yozing")).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles({
        name: "manti.png",
        mimeType: "image/png",
        buffer: pngImage(400),
    })
    await expect(page.getByRole("button", { name: "Almashtirish" })).toBeVisible()
    await page.getByLabel("Nomi").fill("Manti")
    await page.getByLabel("Narxi").fill("30000")
    await expect(page.getByLabel("Narxi")).toHaveValue("30 000")
    await page.getByRole("button", { name: "Taomlar", exact: true }).click()
    await page.getByLabel("Tavsif").fill("5 dona, qovoqli")
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    await expect(page.getByText("Manti")).toBeVisible()

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    // Most products of this shop have no photo: the storefront shows them as a list.
    const tile = page.locator("li").filter({ hasText: "Manti" })
    await expect(tile).toContainText("5 dona, qovoqli")
    await expect(tile.locator("img")).toHaveAttribute("src", /\/img\//)
    // The photo is served, as WebP or the original type.
    const src = await tile.locator("img").getAttribute("src")
    const image = await page.request.get(src ?? "")
    expect(image.status()).toBe(200)
    expect(image.headers()["x-content-type-options"]).toBe("nosniff")
})

test("catalog: edit price, take off for today, hide, show again, delete", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Menyu" }).click()
    await page.getByRole("button", { name: /^Manti/ }).click()
    await expect(page.getByRole("heading", { name: "Mahsulot" })).toBeVisible()
    await page.getByLabel("Narxi").fill("32000")
    await bottomButton(page).click()
    await expect(page.getByText(/32\s000/)).toBeVisible()

    // The switch ignores taps while a save is on its way: wait for each save, as a person would.
    const saved = (): Promise<unknown> =>
        page.waitForResponse(
            (r) => r.url().includes("/owner/products/") && r.request().method() === "PATCH",
        )
    const onSale = page.getByRole("switch", { name: "Sotuvda bor: Manti" })
    // One tap: off for today, and it says so.
    await Promise.all([saved(), onSale.click()])
    await expect(page.getByText("Bugun yo'q")).toBeVisible()
    await expect(page.getByText("Manti bugunga sotuvdan olindi")).toBeVisible()
    await Promise.all([saved(), onSale.click()])
    await expect(onSale).toHaveAttribute("aria-checked", "true")
    // For good: from «⋯». The sheet sits at the bottom of the screen, over everything.
    await page.getByRole("button", { name: "Sotuvdan olish: Manti" }).click()
    const sheet = page.getByRole("dialog")
    const box = await sheet.getByRole("heading", { name: "Sotuvdan olish" }).boundingBox()
    const height = page.viewportSize()?.height ?? 0
    expect(box?.y ?? 0).toBeGreaterThan(height / 2)
    await Promise.all([saved(), page.getByRole("button", { name: "Butunlay yashirish" }).click()])
    await expect(page.getByText("Yashirilgan")).toBeVisible()

    const catalog = (await (
        await apiAs(PEOPLE.customer, "/shop/products", { shop: FOOD })
    ).json()) as {
        data: { name: string }[]
    }
    expect(catalog.data.map((p) => p.name)).not.toContain("Manti")

    await page
        .getByRole("listitem")
        .getByRole("button", { name: /^Manti/ })
        .click()
    await page.getByRole("button", { name: "O'chirish" }).click()
    await expect(page.getByRole("tab", { name: "Menyu" })).toBeVisible()
    await expect(page.getByText("Manti")).toBeHidden()
})

test("catalog in Telegram's native button: «Добавить товар» opens the editor", async ({ page }) => {
    const app = await openOwner(page, { native: true })
    await page.getByRole("tab", { name: "Menyu" }).click()
    await expect.poll(async () => (await app.mainButton())["text"]).toBe("Mahsulot qo'shish")
    await expect(bottomButton(page)).toHaveCount(0)
    await app.pressMainButton()
    await expect(page.getByRole("heading", { name: "Yangi mahsulot" })).toBeVisible()
    await app.back()
    await expect(page.getByRole("tab", { name: "Menyu" })).toBeVisible()
})

test("settings: name, color, delivery and features reach the storefront", async ({ page }) => {
    // The customer's history needs an order to show that «Takrorlash» is gone.
    await placeOrder(PEOPLE.customer, FOOD, [{ productId: "dev-food-p1", quantity: 1 }])
    const app = await openOwner(page)
    await openSettings(page, "Havola, QR-kod va vitrina")
    await expect(
        page.getByText(
            "Do'koningiz Zumda botidagi qidiruvda. Vitrina orqali sotuvdan komissiya: 5%.",
        ),
    ).toBeVisible()
    await expect(page.getByText("https://t.me/osh_markaz_dev_bot")).toBeVisible()
    await settingsBack(page)

    await openGroup(page, "Do'kon")
    // Leaving with an unsaved edit asks first; yes drops the edit.
    await page.getByLabel("Nomi", { exact: true }).fill("Osh Markaz Old")
    await settingsBack(page)
    const asked = (await app.calls()).filter((c) => c.method === "showConfirm")
    expect(String(asked.at(-1)?.args[0])).toContain("saqlanmagan")
    await expect(page.getByRole("button", { name: /^Do'kon\s*Osh Markaz( ·|$)/ })).toBeVisible()

    await openGroup(page, "Do'kon")
    await page.getByLabel("Nomi", { exact: true }).fill("Osh Markaz Guliston")
    await page.getByRole("radio").nth(2).click()
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi").first()).toBeVisible()
    await settingsBack(page)
    await expect(page.getByRole("button", { name: /Osh Markaz Guliston/ })).toBeVisible()

    await openGroup(page, "Yetkazib berish")
    await page.getByLabel("Yetkazish narxi").fill("12000")
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi").first()).toBeVisible()
    await settingsBack(page)
    await expect(page.getByRole("button", { name: /Yetkazib berish\s*12\s000/ })).toBeVisible()

    await openGroup(page, "Do'kon imkoniyatlari")
    await page.getByRole("switch", { name: "Buyurtmani takrorlash" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi").first()).toBeVisible()

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz Guliston" })).toBeVisible()
    await expect(page.getByText(/Yetkazish 12\s000/)).toBeVisible()
    // Reorder is off: no "Повторить" in history.
    await page.getByRole("button", { name: "Buyurtmalarim" }).click()
    await expect(page.getByRole("button", { name: /Buyurtma #1/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Takrorlash" })).toHaveCount(0)
})

test("settings: logo upload and the accepting switch", async ({ page }) => {
    await openOwner(page)
    await openSettings(page, "Do'kon")
    await expect(
        page.getByText("Bot rasmi avtomatik: logotip (yoki nom) va Zumda belgisi."),
    ).toBeVisible()
    const since = await lastSeq()
    await page
        .locator('input[type="file"]')
        .first()
        .setInputFiles({
            name: "logo.png",
            mimeType: "image/png",
            buffer: pngImage(300, [2, 132, 199]),
        })
    await expect(page.locator("img").first()).toHaveAttribute("src", /\/img\//)
    // The logo becomes the shop bot's picture, with the Zumda mark: Zumda sets it, as a JPEG.
    const photo = await waitForCall("setMyProfilePhoto", shopBySlug(FOOD).bot.token, since)
    expect(photo.body["avatar"]).toMatchObject({ contentType: "image/jpeg" })
    // «Buyurtma qabul qilish» heads the list of parts: it moves at once, the check below needs
    // the save to land first.
    await settingsBack(page)
    await Promise.all([
        page.waitForResponse(
            (r) => r.url().endsWith("/owner/shop") && r.request().method() === "PATCH",
        ),
        page.getByRole("switch", { name: "Buyurtma qabul qilish" }).click(),
    ])
    await expect(page.getByRole("switch", { name: "Buyurtma qabul qilish" })).toHaveAttribute(
        "aria-checked",
        "false",
    )
    const shop = (await (await apiAs(PEOPLE.customer, "/shop", { shop: FOOD })).json()) as {
        acceptingOrders: boolean
        logoKey?: string
    }
    expect(shop.acceptingOrders).toBe(false)
    expect(shop.logoKey).toBeTruthy()
    await page.getByRole("switch", { name: "Buyurtma qabul qilish" }).click()
})

test("couriers: invite to the courier bot, approve in the app, days, remove", async ({ page }) => {
    const app = await openOwner(page)
    await openSettings(page, "Kuryerlar")
    await expect(page.getByText("Jasur")).toBeVisible()
    await page.getByRole("button", { name: "Kuryerni taklif qilish" }).click()
    await page.getByRole("button", { name: "Telegram'da yuborish" }).click()
    const shared = (await app.calls()).find((c) => c.method === "openTelegramLink")
    const shareUrl = new URL(String(shared?.args[0]))
    const link = shareUrl.searchParams.get("url") ?? ""
    expect(link).toMatch(/^https:\/\/t\.me\/zumda_kuryer_dev_bot\?start=c_[\w-]{16}$/)
    expect(shareUrl.searchParams.get("text")).toContain("Zumda kuryer botida")

    const since = await lastSeq()
    await courierChat().send(PEOPLE.newCourier, `/start ${link.split("start=")[1] ?? ""}`)
    await waitForMessage(PEOPLE.newCourier.id, "egasi sizni tasdiqlashini kuting", since)
    await waitForMessage(PEOPLE.foodOwner.id, "Bobur kuryer bo'lish taklifini qabul qildi", since)

    // The same link does not work twice.
    await courierChat().send(PEOPLE.stranger, `/start ${link.split("start=")[1] ?? ""}`)
    await waitForMessage(PEOPLE.stranger.id, /ishlamaydi/, since)

    // The app comes back to the front: the new courier waits for approval there.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
    const pending = page.locator("div").filter({
        has: page.getByRole("heading", { name: "Tasdiqlashni kutmoqda" }),
    })
    await expect(pending.getByText("Bobur")).toBeVisible()
    const before = await lastSeq()
    await pending.getByRole("button", { name: "Tasdiqlash" }).click()
    await expect(page.getByText("Kuryer tasdiqlandi")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Tasdiqlashni kutmoqda" })).toBeHidden()
    await waitForMessage(PEOPLE.newCourier.id, "sizni kuryer sifatida tasdiqladi", before)

    // Days: Bobur does not work on Sundays.
    const bobur = page.getByRole("listitem").filter({ hasText: "Bobur" })
    await bobur.getByRole("button", { name: "Ya" }).click()
    await expect(bobur.getByRole("button", { name: "Ya" })).toHaveAttribute("aria-pressed", "false")
    await expect
        .poll(async () => {
            const list = (await (
                await apiAs(PEOPLE.foodOwner, "/owner/couriers", { shop: FOOD })
            ).json()) as { name: string; workDays: string[] }[]
            return list.find((c) => c.name === "Bobur")?.workDays
        })
        .toEqual(["mon", "tue", "wed", "thu", "fri", "sat"])

    await bobur.getByRole("button", { name: "O'chirish: Bobur" }).click()
    await expect(page.getByText("Bobur")).toBeHidden()
    await waitForMessage(PEOPLE.newCourier.id, "kuryerlar ro'yxatidan chiqardi", before)
    expect((await apiAs(PEOPLE.newCourier, "/courier/home", { courierBot: true })).status).toBe(403)
})

test("water shop settings: bottle deposit and returnable bottles", async ({ page }) => {
    await openApp(page, { user: PEOPLE.waterOwner, shop: WATER })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Havola, QR-kod va vitrina")
    await expect(
        page.getByText("Do'koningiz Zumda vitrinasida emas.", { exact: false }),
    ).toBeVisible()
    await settingsBack(page)
    await openGroup(page, "Do'kon imkoniyatlari")
    await page.getByLabel("Bitta idish garovi").fill("35000")
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    const shop = (await (await apiAs(PEOPLE.customer, "/shop", { shop: WATER })).json()) as {
        bottleDeposit: number
    }
    expect(shop.bottleDeposit).toBe(35_000)

    await page.getByRole("tab", { name: "Katalog" }).click()
    await page.getByRole("button", { name: /Toza suv 19 l/ }).click()
    await expect(page.getByRole("switch", { name: "Qaytariladigan idish" })).toHaveAttribute(
        "aria-checked",
        "true",
    )
})

test("a service speaks of services: «Xizmatlar», «Bajarilmoqda», its bot button", async ({
    page,
}) => {
    const since = await lastSeq()
    await shopChat(SERVICE).send(PEOPLE.customer, "/start")
    const welcome = await waitForMessage(PEOPLE.customer.id, "xizmatlarini", since)
    expect(welcome.buttons[0]?.text).toBe("🧰 Xizmatlarni ochish")

    await openApp(page, { user: PEOPLE.serviceOwner, shop: SERVICE })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Xizmatlar" }).click()
    await expect(page.getByText("Gilam yuvish (kv. metr)")).toBeVisible()
})
