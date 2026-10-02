/**
 * The LLS showcase: search across shops in the LLS bot, open a shop there, order with the
 * marketplace channel and commission; the admin signs and ends showcase deals.
 */
import { expect, test } from "@playwright/test"

import { platformBot } from "../stand/config.js"
import { FOOD, PEOPLE, WATER, apiAs, resetStand, payAndAccept } from "../support/stand.js"
import { lastSeq, llsChat, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const search = (page: Page): ReturnType<Page["getByRole"]> =>
    page.getByRole("textbox", { name: "Поиск товара" })

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("the LLS bot greets with the showcase and «connect a shop»", async () => {
    const since = await lastSeq()
    await llsChat().send(PEOPLE.customer, "/start")
    const welcome = await waitForMessage(PEOPLE.customer.id, "LLS", since)
    expect(welcome.token).toBe(platformBot().token)
    expect(welcome.buttons.map((b) => b.web_app?.url)).toEqual([
        "http://localhost:5173/?mode=market",
        "http://localhost:5173/?mode=onboarding",
    ])
})

test("shops with a deal are listed; search works in Latin and Cyrillic", async ({ page }) => {
    await openApp(page, { user: PEOPLE.customer, query: "?mode=market" })
    await expect(page.getByRole("heading", { name: "Магазины вашего района" })).toBeVisible()
    await expect(page.getByText("Магазины · 2")).toBeVisible()
    await expect(page.getByRole("button", { name: /Osh Markaz/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Baraka Market/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Toza Suv/ })).toBeHidden()

    await search(page).fill("ош")
    await expect(page.getByRole("button", { name: /To'y oshi/ })).toBeVisible()
    await search(page).fill("помидор")
    await expect(page.getByRole("button", { name: /Pomidor/ })).toBeVisible()
    await search(page).fill("suv")
    // Water is not in the showcase: its products are not found.
    await expect(page.getByText("Ничего не нашли")).toBeVisible()
    await page.getByRole("button", { name: "Очистить" }).click()
    await expect(page.getByText("Магазины · 2")).toBeVisible()

    await page.getByRole("button", { name: "Супы" }).click()
    await expect(page.getByRole("button", { name: /Lag'mon/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /To'y oshi/ })).toBeHidden()
})

test("a product opens its shop inside the LLS bot; Back returns to the search", async ({
    page,
}) => {
    const app = await openApp(page, { user: PEOPLE.foodOwner, query: "?mode=market" })
    // Each step waits for what it needs, so a stall names itself instead of a 1-minute timeout.
    await expect(search(page)).toBeVisible()
    await search(page).fill("oshi")
    const product = page.getByRole("button", { name: /To'y oshi/ })
    await expect(product).toBeVisible()
    await product.click()
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    // Owner screens never open through the showcase.
    await expect(page.getByRole("button", { name: "Мой магазин" })).toBeHidden()
    await app.back()
    await expect(page.getByRole("heading", { name: "Магазины вашего района" })).toBeVisible()
})

test("an order through the showcase: commission for LLS, LLS bot tells the customer", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, query: "?mode=market" })
    await page.getByRole("button", { name: /Osh Markaz/ }).click()
    await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await page.getByRole("button", { name: "Отправить номер" }).click()
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
    await page.getByRole("textbox", { name: "Адрес" }).fill("Navoiy 7")
    const since = await lastSeq()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Заказ отправлен!" })).toBeVisible()

    // The owner's card comes from the shop's own bot and shows the commission (5% of 45 000).
    const card = await waitForMessage(PEOPLE.foodOwner.id, "#1", since)
    expect(card.token).toContain("100200300:")
    expect(card.text).toMatch(/витрины LLS · комиссия 5%: 2\s250/)

    const orders = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/orders?status=active", { shop: FOOD })
    ).json()) as { data: { id: string; channel: string; commission: number }[] }
    expect(orders.data[0]).toMatchObject({ channel: "marketplace", commission: 2_250 })
    const before = await lastSeq()
    await payAndAccept(PEOPLE.foodOwner, FOOD, orders.data[0]?.id ?? "")
    const told = await waitForMessage(PEOPLE.customer.id, "принят", before)
    expect(told.token).toBe(platformBot().token)
    expect(told.text).toContain("Osh Markaz")

    // The owner sees the LLS mark on the order in «Мой магазин».
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Мой магазин" }).click()
    await expect(page.getByText(/Из витрины LLS · комиссия 2\s250/)).toBeVisible()
})

test("orders through the shop's own bot carry no commission", async () => {
    const response = await apiAs(PEOPLE.customer, "/orders", {
        shop: FOOD,
        method: "POST",
        json: {
            items: [{ productId: "dev-food-p1", quantity: 1 }],
            address: "Navoiy 7",
            channel: "marketplace",
        },
    })
    // The showcase order handed the phone to this shop, so its own bot can take the order;
    // the client asked for "marketplace", but the signing bot decides: no commission.
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ channel: "shop_bot", commission: 0 })
})

test("the admin adds and removes a shop; others cannot", async ({ page }) => {
    const since = await lastSeq()
    await llsChat().send(PEOPLE.stranger, `/market ${WATER} 3`)
    await llsChat().send(PEOPLE.admin, `/market ${WATER} 3`)
    await waitForMessage(PEOPLE.admin.id, "3%", since)
    await waitForMessage(PEOPLE.waterOwner.id, "Комиссия: 3%", since)
    expect((await apiAs(PEOPLE.stranger, "/showcase/shops")).status).toBe(200)

    await openApp(page, { user: PEOPLE.customer, query: "?mode=market" })
    await expect(page.getByText("Магазины · 3")).toBeVisible()
    await llsChat().send(PEOPLE.admin, `/market ${WATER} off`)
    await waitForMessage(PEOPLE.waterOwner.id, "убран из витрины", since)
    await page.reload()
    await expect(page.getByText("Магазины · 2")).toBeVisible()

    await llsChat().send(PEOPLE.admin, "/market nonsense")
    await waitForMessage(PEOPLE.admin.id, "/market <slug>", since)
})

test("search is rate-limited per person", async ({ page }) => {
    // A fresh person per run: the limiter keeps its minute across repeated runs of this test.
    const person = { ...PEOPLE.newOwner, id: 500_000 + Math.floor(Math.random() * 400_000) }
    const statuses: number[] = []
    for (let i = 0; i < 31; i++) {
        statuses.push((await apiAs(person, "/showcase/products?q=osh")).status)
    }
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
    await openApp(page, { user: person, query: "?mode=market" })
    await search(page).fill("osh")
    await expect(page.getByText("Слишком много запросов. Попробуйте через минуту.")).toBeVisible()
})
