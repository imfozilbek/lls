/**
 * Customer edge cases: declined phone or location, a paused or closed shop, stop-list,
 * an item that ran out while in the cart, Uzbek texts, a wrong bot, outside Telegram.
 */
import { expect, test } from "@playwright/test"

import { FOOD, GROCERY, PEOPLE, apiAs, resetStand, payAndAccept } from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

async function ownerPatch(path: string, json: object, shop = FOOD): Promise<void> {
    const response = await apiAs(PEOPLE.foodOwner, path, { shop, method: "PATCH", json })
    expect(response.status, await response.clone().text()).toBe(200)
}

async function toCheckout(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("declining the phone keeps the order button off; declining location says so", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.stranger, shop: FOOD, contact: "decline", location: null })
    await toCheckout(page)
    await page.getByRole("button", { name: "Raqamni yuborish" }).click()
    await expect(page.getByRole("button", { name: "Raqamni yuborish" })).toBeVisible()
    await page.getByRole("textbox", { name: "Manzil" }).fill("Navoiy 3")
    // No dead button: a tap says what is missing and nothing is sent.
    await bottomButton(page).click()
    await expect(page.getByText("Avval telefon raqamingizni yuboring")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toHaveCount(0)
    await page.getByRole("button", { name: "Joylashuvni yuborish" }).click()
    await expect(page.getByText("Joylashuvni olib bo'lmadi")).toBeVisible()
})

test("a contact of another person is not saved as the customer's phone", async ({ page }) => {
    const app = await openApp(page, { user: PEOPLE.stranger, shop: FOOD, contact: "decline" })
    await app.chat.shareContact(PEOPLE.stranger, "+998909999999", PEOPLE.customer.id)
    const me = (await (await apiAs(PEOPLE.stranger, "/me", { shop: FOOD })).json()) as {
        phone?: string
    }
    expect(me.phone).toBeUndefined()
})

test("a shop that delivers within a radius shows it and asks for the pin", async ({ page }) => {
    const shop = (await (await apiAs(PEOPLE.foodOwner, "/owner/shop", { shop: FOOD })).json()) as {
        delivery: { fee: number; freeFrom?: number; minOrder?: number }
    }
    const { fee, freeFrom, minOrder } = shop.delivery
    await ownerPatch("/owner/shop", { delivery: { fee, freeFrom, minOrder, radiusMeters: 3_000 } })
    // The phone is there first: the next missing thing must be the pin.
    const first = await openApp(page, { user: PEOPLE.stranger, shop: FOOD, location: null })
    await first.chat.shareContact(PEOPLE.stranger, "+998909999999", PEOPLE.stranger.id)
    await openApp(page, { user: PEOPLE.stranger, shop: FOOD, location: null })
    await expect(page.getByText("3 km gacha yetkazamiz")).toBeVisible()
    await toCheckout(page)
    await expect(page.getByText("Majburiy: do'kon 3 km gacha yetkazadi.")).toBeVisible()
    await expect(page.getByText("+998 90 999 99 99")).toBeVisible()
    await bottomButton(page).click()
    await expect(
        page.getByText("Joylashuvni yuboring: do'kon shu bo'yicha masofani tekshiradi"),
    ).toBeVisible()
    await ownerPatch("/owner/shop", {
        delivery: { fee, freeFrom, minOrder, radiusMeters: null },
    })
})

test("a paused shop shows it and takes no orders", async ({ page }) => {
    await ownerPatch("/owner/shop", { acceptingOrders: false })
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByText("Buyurtma vaqtincha qabul qilinmaydi")).toBeVisible()
    await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Do'kon hozir buyurtma qabul qilmayapti.")).toBeVisible()
    // Never a dead button: a tap says why and stays in the cart.
    await bottomButton(page).click()
    await expect(page.getByText("Do'kon hozir buyurtma qabul qilmayapti.")).toHaveCount(2)
    await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
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
    await expect(page.getByText("Hozir yopiq")).toBeVisible()
    await expect(page.getByText(`Bugun ${opens}–${closes}`)).toBeVisible()
    await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Do'kon hozir yopiq. Ish vaqtida buyurtma bering.")).toBeVisible()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
    await ownerPatch("/owner/shop", { workingHours: null })
})

test("a stop-listed item disappears; one that ran out in the cart is removed with a note", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Qo'shish: Lag'mon" }).click()
    await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
    await ownerPatch("/owner/products/dev-food-p2", { stopForToday: true })
    await page.reload()
    await expect(page.getByRole("heading", { name: "Lag'mon" })).toBeHidden()
    await expect(
        page.getByText("Savatdagi 1 ta mahsulot tugab qoldi, ularni olib tashladik."),
    ).toBeVisible()
    await expect(bottomButton(page)).toContainText("Savat · 1")
    await ownerPatch("/owner/products/dev-food-p2", { isAvailable: true })
})

test("an item that runs out during checkout is refused and dropped from the cart", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await page.getByRole("button", { name: "Raqamni yuborish" }).click()
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
    await page.getByRole("textbox", { name: "Manzil" }).fill("Navoiy 3")
    await ownerPatch("/owner/products/dev-food-p1", { isAvailable: false })
    await bottomButton(page).click()
    await expect(page.getByText("Savatdagi mahsulotlardan biri tugab qoldi.")).toBeVisible()
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
    await payAndAccept(PEOPLE.groceryOwner, GROCERY, orders.data[0]?.id ?? "")
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
    await expect(page.getByText("Ilovani Telegram'dagi do'kon botidan oching.")).toBeVisible()
})

test("an unknown shop link shows a clear message", async ({ page }) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD, query: "?shop=no-such-shop" })
    await expect(page.getByRole("heading", { name: "Do'kon topilmadi" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Qayta urinish" })).toBeHidden()
})

test("a long catalog has a search: Latin or Cyrillic, nothing found says so", async ({ page }) => {
    const shopProducts = async (): Promise<number> =>
        (
            (await (await apiAs(PEOPLE.customer, "/shop/products", { shop: GROCERY })).json()) as {
                data: unknown[]
            }
        ).data.length
    // More than 20 products: the search field appears.
    const add = async (name: string): Promise<void> => {
        const created = await apiAs(PEOPLE.groceryOwner, "/owner/products", {
            shop: GROCERY,
            method: "POST",
            json: { name, price: 12_000, unit: "pcs", category: "groceries" },
        })
        expect(created.status, await created.clone().text()).toBe(201)
    }
    await add("Shokolad Alpen")
    for (let i = (await shopProducts()) + 1; i <= 21; i++) {
        await add(`Mahsulot ${i}`)
    }
    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    const search = page.getByRole("textbox", { name: "Katalogdan qidirish" })
    await search.fill("шоколад")
    await expect(page.getByRole("heading", { name: "Shokolad Alpen" })).toBeVisible()
    await expect(page.getByRole("heading", { name: /^Mahsulot/ })).toHaveCount(0)
    await search.fill("zzzz")
    await expect(page.getByText("Hech narsa topilmadi")).toBeVisible()
    await page.getByRole("button", { name: "Qidiruvni tozalash" }).click()
    await expect(page.getByRole("heading", { name: /^Mahsulot/ }).first()).toBeVisible()
})
