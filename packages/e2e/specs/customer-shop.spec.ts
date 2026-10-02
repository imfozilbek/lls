/**
 * Customer of a shop's own bot: open → browse → cart → order → track → cancel → history.
 */
import { expect, test } from "@playwright/test"

import { FOOD, GROCERY, PEOPLE, WATER, apiAs, resetStand } from "../support/stand.js"
import { lastSeq, messagesTo, shopChat, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const money = (digits: string): RegExp => new RegExp(digits.replace(" ", "\\s?"))

async function add(page: Page, name: string, times = 1): Promise<void> {
    await page.getByRole("button", { name: `Добавить: ${name}` }).click()
    for (let i = 1; i < times; i++) {
        await page.getByRole("group", { name }).getByRole("button", { name: "Добавить" }).click()
    }
}

async function checkout(page: Page, address = "Mustaqillik 5"): Promise<void> {
    await bottomButton(page).click() // cart
    await bottomButton(page).click() // checkout
    await expect(page.getByRole("heading", { name: "Заказ" })).toBeVisible()
    // The phone is asked only once: Telegram already gave it to this shop.
    const share = page.getByRole("button", { name: "Отправить номер" })
    if (await share.isVisible()) {
        await share.click()
    }
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
    await page.getByRole("textbox", { name: "Адрес" }).fill(address)
}

test.describe.configure({ mode: "serial" })

test.describe("customer of a food shop", () => {
    test.beforeAll(resetStand)

    test("the shop bot greets with a button that opens the storefront", async () => {
        const since = await lastSeq()
        await shopChat(FOOD).send(PEOPLE.customer, "/start")
        const welcome = await waitForMessage(PEOPLE.customer.id, "Osh Markaz", since)
        expect(welcome.buttons[0]?.web_app?.url).toBe(`http://localhost:5173/?shop=${FOOD}`)
    })

    test("storefront: brand, facts, categories, cart nudges and minimum order", async ({
        page,
    }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
        await expect(page.getByText(/Доставка 10\s000/)).toBeVisible()
        await expect(page.getByText(/Минимум 40\s000/)).toBeVisible()
        await expect(page.getByText("Открыто")).toBeVisible()

        // Categories filter the menu.
        await page.getByRole("button", { name: "Супы" }).click()
        await expect(page.getByRole("heading", { name: "Lag'mon" })).toBeVisible()
        await expect(page.getByRole("heading", { name: "To'y oshi" })).toBeHidden()
        await page.getByRole("button", { name: "Всё", exact: true }).click()

        await add(page, "Somsa tandir", 2)
        // The button counts positions, not pieces (kg items would show grams otherwise).
        await expect(bottomButton(page)).toContainText(/Корзина · 1 · 16\s000/)
        await bottomButton(page).click()

        await expect(page.getByRole("heading", { name: "Корзина" })).toBeVisible()
        await expect(page.getByText(/До минимального заказа ещё 24\s000/)).toBeVisible()
        await expect(bottomButton(page)).toBeDisabled()

        // Remove one, then reach the minimum with a main dish.
        await page
            .getByRole("group", { name: "Somsa tandir" })
            .getByRole("button", { name: "Убрать" })
            .click()
        await expect(page.getByText(/До минимального заказа ещё 32\s000/)).toBeVisible()
        await page
            .getByRole("group", { name: "Somsa tandir" })
            .getByRole("button", { name: "Убрать" })
            .click()
        await expect(page.getByText("Корзина пуста")).toBeVisible()
        await page.getByRole("button", { name: "В меню" }).click()
        await add(page, "To'y oshi")
        await bottomButton(page).click()
        await expect(page.getByText(/До бесплатной доставки ещё 105\s000/)).toBeVisible()
        await expect(bottomButton(page)).toBeEnabled()
        await expect(bottomButton(page)).toContainText(money("55 000"))
    })
})

test.describe("customer of a food shop: order and status", () => {
    test("order in a few taps: phone from Telegram, address, landmark, location", async ({
        page,
    }) => {
        const app = await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await add(page, "To'y oshi")
        await bottomButton(page).click()
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Заказ" })).toBeVisible()
        // Nothing to send yet: no phone, no address.
        await expect(bottomButton(page)).toBeDisabled()

        await page.getByRole("button", { name: "Отправить номер" }).click()
        await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
        await page.getByRole("textbox", { name: "Адрес" }).fill("Mustaqillik 5")
        await page.getByLabel("Ориентир").fill("возле школы, синие ворота")
        await page.getByRole("button", { name: "Отправить геолокацию" }).click()
        await expect(page.getByText("Геолокация добавлена")).toBeVisible()
        await page.getByLabel("Комментарий").fill("3 этаж")
        // Only a transfer to the shop's card (the whole path is covered in money.spec).
        await expect(page.getByRole("heading", { name: "Оплата переводом" })).toBeVisible()

        const since = await lastSeq()
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Заказ отправлен!" })).toBeVisible()
        await expect(page.getByRole("heading", { name: "Заказ #1" })).toBeVisible()
        await expect(page.getByText("возле школы, синие ворота")).toBeVisible()
        const asked = (await app.calls()).map((c) => c.method)
        expect(asked).toContain("requestContact")
        expect(asked).toContain("requestWriteAccess")

        // The owner gets the order card from the shop bot, with the next step and "cancel".
        const card = await waitForMessage(PEOPLE.foodOwner.id, "#1", since)
        expect(card.text).toContain("To'y oshi")
        expect(card.text).toContain("Mustaqillik 5")
        expect(card.text).toContain("возле школы")
        expect(card.text).toContain("3 этаж")
        expect(card.text).toContain("+998 90 123 45 67")
        expect(card.buttons.map((b) => b.callback_data)).toEqual(
            expect.arrayContaining([expect.stringMatching(/^p:/), expect.stringMatching(/^x:/)]),
        )
        // "To menu" after placing.
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    })

    test("the money came, the owner accepts in the chat; the customer can no longer cancel", async ({
        page,
    }) => {
        const card = (await messagesTo(PEOPLE.foodOwner.id)).find((m) => m.text.includes("#1"))
        const accept = card?.buttons.find((b) => b.callback_data?.startsWith("p:"))
        expect(accept?.text).toBe("💳 Деньги пришли — принять")
        const since = await lastSeq()
        await shopChat(FOOD).press(PEOPLE.foodOwner, accept?.callback_data ?? "")
        await waitForMessage(PEOPLE.customer.id, "Оплата получена, заказ #1 принят", since)

        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: "Мои заказы" }).click()
        await page.getByRole("button", { name: /Заказ #1/ }).click()
        await expect(page.getByRole("heading", { name: "Принят" })).toBeVisible()
        await expect(page.getByRole("button", { name: "Отменить заказ" })).toBeHidden()
    })
})

/** Continues with the orders placed above (the specs run in order). */
test.describe("customer of a food shop: cancel, history, language", () => {
    test("the customer cancels while the order is new; the owner is told", async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await add(page, "To'y oshi")
        await checkout(page)
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Заказ #2" })).toBeVisible()
        const since = await lastSeq()
        await page.getByRole("button", { name: "Отменить заказ" }).click()
        await expect(page.getByRole("heading", { name: "Отменён" })).toBeVisible()
        await waitForMessage(PEOPLE.foodOwner.id, "Клиент отменил", since)
    })

    test("history lists orders; a finished one is ordered again in one tap", async ({ page }) => {
        // Deliver order #1 through the owner's API.
        const orders = (await (
            await apiAs(PEOPLE.foodOwner, "/owner/orders?status=active", { shop: FOOD })
        ).json()) as {
            data: { id: string; number: number }[]
        }
        const first = orders.data.find((o) => o.number === 1)
        for (const status of ["preparing", "ready", "picked_up", "delivered"]) {
            const response = await apiAs(PEOPLE.foodOwner, `/owner/orders/${first?.id ?? ""}`, {
                shop: FOOD,
                method: "PATCH",
                json: { status },
            })
            expect(response.status).toBe(200)
        }
        await waitForMessage(PEOPLE.customer.id, "Заказ #1 доставлен")

        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: "Мои заказы" }).click()
        await expect(page.getByRole("button", { name: /Заказ #2.*Отменён/ })).toBeVisible()
        await expect(page.getByRole("button", { name: /Заказ #1.*Доставлен/ })).toBeVisible()
        await page.getByRole("button", { name: "Повторить" }).first().click()
        await expect(page.getByRole("heading", { name: "Корзина" })).toBeVisible()
        await expect(page.getByRole("group", { name: "To'y oshi" })).toContainText("1")
    })

    test("the language switch changes the app and is saved for the bots", async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: "uz", exact: true }).click()
        await expect(page.getByRole("button", { name: "Buyurtmalarim" })).toBeVisible()
        await expect
            .poll(
                async () =>
                    (
                        (await (await apiAs(PEOPLE.customer, "/me", { shop: FOOD })).json()) as {
                            language: string
                        }
                    ).language,
            )
            .toBe("uz")
        await page.getByRole("button", { name: "ru", exact: true }).click()
        await expect(page.getByRole("button", { name: "Мои заказы" })).toBeVisible()
    })
})

test.describe("customer of a water shop", () => {
    test.beforeAll(resetStand)

    test("empty bottles lower the deposit; the owner card shows them", async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: WATER })
        await expect(page.getByRole("heading", { name: "Toza Suv", exact: true })).toBeVisible()
        await add(page, "Toza suv 19 l", 2)
        await checkout(page)
        // Two bottles, none handed back yet: deposit 2 × 30 000.
        await expect(page.getByText("Залог за бутыли")).toBeVisible()
        await expect(page.getByText(money("60 000"))).toBeVisible()
        await page
            .getByRole("group", { name: "Пустые бутыли" })
            .getByRole("button", { name: "Добавить" })
            .click()
        await expect(page.getByText(money("30 000")).first()).toBeVisible()
        await expect(bottomButton(page)).toContainText(money("70 000"))
        const since = await lastSeq()
        await bottomButton(page).click()
        await expect(page.getByText("Отдаёте пустых бутылей: 1")).toBeVisible()
        const card = await waitForMessage(PEOPLE.waterOwner.id, "#1", since)
        expect(card.text).toContain("Вернёт пустых бутылей: 1")
    })
})

test.describe("customer of a grocery", () => {
    test.beforeAll(resetStand)

    test("weight items go by the shop's step; the price follows the grams", async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
        await add(page, "Pomidor", 3)
        await expect(page.getByRole("group", { name: "Pomidor" })).toContainText("1,5 кг")
        await add(page, "Mol go'shti")
        await expect(page.getByRole("group", { name: "Mol go'shti" })).toContainText("0,25 кг")
        await bottomButton(page).click()
        // 1.5 kg × 12 000 + 0.25 kg × 95 000 = 18 000 + 23 750
        await expect(page.getByText(money("41 750")).first()).toBeVisible()
        await bottomButton(page).click()
        await page.getByRole("button", { name: "Отправить номер" }).click()
        await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
        await page.getByRole("textbox", { name: "Адрес" }).fill("Navoiy 1")
        const since = await lastSeq()
        await bottomButton(page).click()
        await expect(page.getByText("Pomidor")).toBeVisible()
        const card = await waitForMessage(PEOPLE.groceryOwner.id, "#1", since)
        expect(card.text).toContain("1,5 кг")
    })
})
