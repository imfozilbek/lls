/**
 * A new owner connects a shop through the LLS bot; the platform admin approves or rejects;
 * a failed bot connection is retried with /reconnect; failures reach the admin as alerts.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, placeOrder, resetStand, payAndAccept } from "../support/stand.js"
import {
    callsOf,
    chatWithSecret,
    controlTelegram,
    lastSeq,
    llsChat,
    messagesTo,
    waitForMessage,
} from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { TgUser } from "../support/telegram.js"
import type { Page } from "@playwright/test"

// Fake tokens: the stand's Telegram accepts `<id>:NEW-...`. secret-scan: fake
const NEW_BOT = { id: 777100200, token: "777100200:NEW-e2e-onboarding-token-abcdefghij" } // secret-scan: fake
const SECOND_BOT = { id: 777100201, token: "777100201:NEW-e2e-onboarding-token-klmnopqrst" } // secret-scan: fake
const UNKNOWN_TOKEN = "999999999:AAunknown-token-for-e2e-checks-xxxxx" // secret-scan: fake

interface MyShop {
    id: string
    slug: string
    name: string
    status: string
}

const SECOND_OWNER = { id: 4005, first_name: "Dilnoza", language_code: "ru" }
const THIRD_OWNER = { id: 4006, first_name: "Jamshid", language_code: "ru" }

async function myShops(owner: TgUser = PEOPLE.newOwner): Promise<MyShop[]> {
    const response = await apiAs(owner, "/platform/shops")
    return (await response.json()) as MyShop[]
}

async function apply(page: Page, token: string, name: string): Promise<void> {
    await page.getByLabel("Токен бота").fill(token)
    await bottomButton(page).click()
    await page.getByLabel("Название магазина").fill(name)
    await page.getByRole("radio", { name: "Продукты" }).click()
    await page.getByLabel(/Адрес/).fill("Guliston, Navoiy 20")
    await bottomButton(page).click()
    await page.getByLabel("Стоимость доставки").fill("5000")
    // Customers pay only by transfer: no card, no «Отправить заявку».
    await expect(bottomButton(page)).toBeDisabled()
    await page.getByLabel("Номер карты").fill("4111 1111 1111 1112")
    await expect(page.getByText("В номере ошибка: проверьте цифры.")).toBeVisible()
    await page.getByLabel("Номер карты").fill("4111 1111 1111 1111")
    await page.getByLabel("Имя на карте").fill("Sardor Aliyev")
    await bottomButton(page).click()
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("a wrong token is refused and the wizard returns to the bot step", async ({ page }) => {
    const app = await openApp(page, { user: PEOPLE.newOwner, query: "?mode=onboarding" })
    await expect(page.getByRole("heading", { name: "Подключите магазин" })).toBeVisible()
    await bottomButton(page).click() // «Начать»
    await expect(page.getByText("Шаг 1 из 3")).toBeVisible()
    await page.getByRole("button", { name: "Открыть @BotFather" }).click()
    expect((await app.calls()).find((c) => c.method === "openTelegramLink")?.args[0]).toBe(
        "https://t.me/BotFather",
    )
    await apply(page, UNKNOWN_TOKEN, "Yangi Non")
    await expect(
        page.getByText("Неверный токен. Скопируйте его из BotFather целиком."),
    ).toBeVisible()
    await expect(page.getByText("Шаг 1 из 3")).toBeVisible()
})

test("the application reaches the admin; the pending shop opens only for its owner", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.newOwner, query: "?mode=onboarding" })
    await bottomButton(page).click()
    const since = await lastSeq()
    await apply(page, NEW_BOT.token, "Yangi Non")
    await expect(page.getByRole("heading", { name: "Заявка отправлена!" })).toBeVisible()
    await bottomButton(page).click() // «Готово»
    await expect(page.getByText("Yangi Non")).toBeVisible()
    await expect(page.getByText("На проверке")).toBeVisible()

    await waitForMessage(PEOPLE.newOwner.id, "Заявка", since)
    const card = await waitForMessage(PEOPLE.admin.id, "Новый магазин", since)
    expect(card.text).toContain("Yangi Non")
    expect(card.buttons.map((b) => b.text)).toEqual(["✅ Одобрить", "❌ Отклонить"])

    const [shop] = await myShops()
    await openApp(page, {
        user: PEOPLE.newOwner,
        query: `?shop=${shop?.slug ?? ""}`,
        signWith: NEW_BOT.token,
    })
    await expect(page.getByRole("button", { name: "Мой магазин" })).toBeVisible()
    await openApp(page, {
        user: PEOPLE.customer,
        query: `?shop=${shop?.slug ?? ""}`,
        signWith: NEW_BOT.token,
    })
    await expect(page.getByRole("button", { name: "Мой магазин" })).toBeHidden()
    await expect(page.getByRole("heading", { name: "Магазин не найден" })).toBeVisible()
})

test("the same bot cannot be connected twice", async () => {
    const response = await apiAs(PEOPLE.newOwner, "/platform/shops", {
        method: "POST",
        json: {
            botToken: NEW_BOT.token,
            name: "Again",
            type: "grocery",
            deliveryFee: 0,
            payoutCard: { number: "4111111111111111", holder: "Sardor Aliyev" },
        },
    })
    expect(response.status).toBe(409)
})

test("a stranger cannot approve; the admin approves: webhook, menu button, owner told", async ({
    page,
}) => {
    const card = await waitForMessage(PEOPLE.admin.id, "Новый магазин")
    const approve = card.buttons.find((b) => b.text === "✅ Одобрить")?.callback_data ?? ""
    await llsChat().press(PEOPLE.stranger, approve)
    expect((await myShops())[0]?.status).toBe("pending")

    const since = await lastSeq()
    await llsChat().press(PEOPLE.admin, approve)
    await waitForMessage(PEOPLE.newOwner.id, "запущен", since)
    const [hook] = await callsOf("setWebhook", since)
    expect(hook?.token).toBe(NEW_BOT.token)
    expect(hook?.body["url"]).toBe(`http://localhost:8787/tg/${NEW_BOT.id}`)
    const [menu] = await callsOf("setChatMenuButton", since)
    const shop = (await myShops())[0]
    expect(JSON.stringify(menu?.body)).toContain(`?shop=${shop?.slug ?? ""}`)
    expect(shop?.status).toBe("active")

    // The new shop bot answers through its own webhook.
    const secret = String(hook?.body["secret_token"])
    const before = await lastSeq()
    await chatWithSecret(NEW_BOT.id, secret).send(PEOPLE.customer, "/start")
    await waitForMessage(PEOPLE.customer.id, "Yangi Non", before)

    await openApp(page, {
        user: PEOPLE.customer,
        query: `?shop=${shop?.slug ?? ""}`,
        signWith: NEW_BOT.token,
    })
    await expect(page.getByText("Каталог пока пустой")).toBeVisible()
})

test("a failed connection warns the admin; /reconnect fixes it", async () => {
    const since = await lastSeq()
    await openAndApply(SECOND_OWNER, SECOND_BOT.token, "Ikkinchi Do'kon")
    const card = await waitForMessage(PEOPLE.admin.id, "Ikkinchi", since)
    await controlTelegram({ failWebhooks: true })
    await llsChat().press(PEOPLE.admin, card.buttons[0]?.callback_data ?? "")
    const warning = await waitForMessage(PEOPLE.admin.id, "не подключился", since)
    const slug = /\/reconnect ([a-z0-9-]+)/.exec(warning.text)?.[1] ?? ""
    expect(slug).not.toBe("")

    await controlTelegram({ failWebhooks: false })
    await llsChat().send(PEOPLE.stranger, `/reconnect ${slug}`)
    await llsChat().send(PEOPLE.admin, `/reconnect ${slug}`)
    await waitForMessage(PEOPLE.admin.id, "бот подключён", since)
})

test("a rejected shop is told and never opens", async ({ page }) => {
    const since = await lastSeq()
    const third = "777100202:NEW-e2e-onboarding-token-uvwxyzabcd" // secret-scan: fake
    await openAndApply(THIRD_OWNER, third, "Uchinchi")
    const card = await waitForMessage(PEOPLE.admin.id, "Uchinchi", since)
    await llsChat().press(PEOPLE.admin, card.buttons[1]?.callback_data ?? "")
    await waitForMessage(THIRD_OWNER.id, "отклонена", since)
    const rejected = (await myShops(THIRD_OWNER)).find((s) => s.name === "Uchinchi")
    expect(rejected?.status).toBe("disabled")
    await openApp(page, {
        user: THIRD_OWNER,
        query: `?shop=${rejected?.slug ?? ""}`,
        signWith: third,
    })
    await expect(page.getByRole("button", { name: "Мой магазин" })).toBeHidden()
})

test("admins hear about failures: a notification that did not go out", async () => {
    await controlTelegram({ broken: [PEOPLE.foodOwner.id] })
    const since = await lastSeq()
    await placeOrder(PEOPLE.customer, FOOD, [{ productId: "dev-food-p1", quantity: 1 }])
    const alert = await waitForMessage(PEOPLE.admin.id, "сообщение не отправлено", since)
    expect(alert.text).toContain("Internal Server Error")
    expect(alert.text).not.toContain("DEV-local-only-token")
    await controlTelegram({ broken: [] })
})

test("a customer who blocked the bot is not an alert", async () => {
    await controlTelegram({ blocked: [PEOPLE.customer.id] })
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const alerts = await messagesTo(PEOPLE.admin.id, since)
    expect(alerts.filter((m) => m.text.includes("🚨"))).toHaveLength(0)
    await controlTelegram({ blocked: [] })
})

async function openAndApply(owner: TgUser, token: string, name: string): Promise<void> {
    const response = await apiAs(owner, "/platform/shops", {
        method: "POST",
        json: {
            botToken: token,
            name,
            type: "grocery",
            deliveryFee: 5_000,
            payoutCard: { number: "4111111111111111", holder: "Test Owner" },
        },
    })
    expect(response.status).toBe(201)
}
