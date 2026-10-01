/**
 * Customer edge cases: declined phone or location, a paused or closed shop, stop-list,
 * an item that ran out while in the cart, Uzbek texts, a wrong bot, outside Telegram.
 */
import { expect, test } from "@playwright/test"

import { FOOD, GROCERY, PEOPLE, apiAs, resetStand } from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

async function ownerPatch(path: string, json: object, shop = FOOD): Promise<void> {
    const response = await apiAs(PEOPLE.foodOwner, path, { shop, method: "PATCH", json })
    expect(response.status, await response.clone().text()).toBe(200)
}

async function toCheckout(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Заказ" })).toBeVisible()
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("declining the phone keeps the order button off; declining location says so", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.stranger, shop: FOOD, contact: "decline", location: null })
    await toCheckout(page)
    await page.getByRole("button", { name: "Отправить номер" }).click()
    await expect(page.getByRole("button", { name: "Отправить номер" })).toBeVisible()
    await page.getByRole("textbox", { name: "Адрес" }).fill("Navoiy 3")
    await expect(bottomButton(page)).toBeDisabled()
    await page.getByRole("button", { name: "Отправить геолокацию" }).click()
    await expect(page.getByText("Не удалось получить геолокацию")).toBeVisible()
})

test("a contact of another person is not saved as the customer's phone", async ({ page }) => {
    const app = await openApp(page, { user: PEOPLE.stranger, shop: FOOD, contact: "decline" })
    await app.chat.shareContact(PEOPLE.stranger, "+998909999999", PEOPLE.customer.id)
    const me = (await (await apiAs(PEOPLE.stranger, "/me", { shop: FOOD })).json()) as {
        phone?: string
    }
    expect(me.phone).toBeUndefined()
})

test("a paused shop shows it and takes no orders", async ({ page }) => {
    await ownerPatch("/owner/shop", { acceptingOrders: false })
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByText("Заказы временно не принимаются")).toBeVisible()
    await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Магазин сейчас не принимает заказы.")).toBeVisible()
    await expect(bottomButton(page)).toBeDisabled()
    await ownerPatch("/owner/shop", { acceptingOrders: true })
})

test("outside working hours the shop is closed and says so", async ({ page }) => {
    const nowHour = Number(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", timeZone: "Asia/Tashkent" }).format(
            new Date(),
        ),
    )
    const opens = `${String((nowHour + 2) % 24).padStart(2, "0")}:00`
    const closes = `${String((nowHour + 3) % 24).padStart(2, "0")}:00`
    const hours = Object.fromEntries(ALL_DAYS.map((d) => [d, { open: opens, close: closes }]))
    await ownerPatch("/owner/shop", { workingHours: hours })
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByText("Сейчас закрыто")).toBeVisible()
    await expect(page.getByText(`Сегодня ${opens}–${closes}`)).toBeVisible()
    await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Магазин сейчас закрыт. Закажите в рабочее время.")).toBeVisible()
    await expect(bottomButton(page)).toBeDisabled()
    await ownerPatch("/owner/shop", { workingHours: null })
})

test("a stop-listed item disappears; one that ran out in the cart is removed with a note", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Добавить: Lag'mon" }).click()
    await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
    await ownerPatch("/owner/products/dev-food-p2", { stopForToday: true })
    await page.reload()
    await expect(page.getByRole("heading", { name: "Lag'mon" })).toBeHidden()
    await expect(page.getByText("Закончилось товаров из корзины: 1. Мы их убрали.")).toBeVisible()
    await expect(bottomButton(page)).toContainText("Корзина · 1")
    await ownerPatch("/owner/products/dev-food-p2", { isAvailable: true })
})

test("an item that runs out during checkout is refused and dropped from the cart", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await page.getByRole("button", { name: "Отправить номер" }).click()
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
    await page.getByRole("textbox", { name: "Адрес" }).fill("Navoiy 3")
    await ownerPatch("/owner/products/dev-food-p1", { isAvailable: false })
    await bottomButton(page).click()
    await expect(page.getByText("Один из товаров в корзине закончился.")).toBeVisible()
    await ownerPatch("/owner/products/dev-food-p1", { isAvailable: true })
})

test("Uzbek customer: texts and bot messages in Uzbek", async ({ page }) => {
    await openApp(page, { user: PEOPLE.customerUz, shop: GROCERY })
    await expect(page.getByRole("button", { name: "Buyurtmalarim" })).toBeVisible()
    await page.getByRole("button", { name: /Mol go'shti/ }).click()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
    await bottomButton(page).click()
    await page.getByRole("button", { name: "Raqamni yuborish" }).click()
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
    await page.getByRole("textbox", { name: "Manzil" }).fill("Navoiy 9")
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toBeVisible()
    const since = await lastSeq()
    const orders = (await (
        await apiAs(PEOPLE.groceryOwner, "/owner/orders?status=active", { shop: GROCERY })
    ).json()) as { data: { id: string }[] }
    await apiAs(PEOPLE.groceryOwner, `/owner/orders/${orders.data[0]?.id ?? ""}`, {
        shop: GROCERY,
        method: "PATCH",
        json: { status: "accepted" },
    })
    await waitForMessage(PEOPLE.customerUz.id, "qabul qilindi", since)
})

test("outside Telegram the app explains where to open it", async ({ page }) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD, noInitData: true })
    await expect(page.getByRole("heading", { name: /Telegram/ })).toBeVisible()
})

test("initData from another shop's bot is refused", async ({ page }) => {
    await openApp(page, {
        user: PEOPLE.customer,
        shop: FOOD,
        signWith: "100200301:DEV-local-only-token-not-a-real-bot-yy", // secret-scan: fake
    })
    await expect(page.getByText("Откройте приложение из бота магазина в Telegram.")).toBeVisible()
})

test("an unknown shop link shows a clear message", async ({ page }) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD, query: "?shop=no-such-shop" })
    await expect(page.getByRole("heading", { name: "Магазин не найден" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Повторить" })).toBeHidden()
})
