/**
 * A new owner connects a shop through the Zumda bot; the platform admin approves or rejects;
 * a failed bot connection is retried from «Platforma»; failures reach the admin as alerts.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, placeOrder, resetStand, payAndAccept } from "../support/stand.js"
import {
    callsOf,
    chatWithSecret,
    controlTelegram,
    lastSeq,
    businessChat,
    messagesTo,
    waitForCall,
    waitForMessage,
} from "../support/telegram.js"
import { appQueryOf, bottomButton, openApp } from "../support/webapp.js"

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
    const response = await apiAs(owner, "/platform/shops", { businessBot: true })
    return (await response.json()) as MyShop[]
}

/**
 * Three short steps: the business, the bot (the BotFather way: «Menda bot bor» → the token),
 * where it is. The card and the fee wait in «Ishga tayyor».
 */
async function apply(page: Page, token: string, name: string): Promise<void> {
    await page.getByLabel("Biznes nomi").fill(name)
    await page.getByRole("radio", { name: "Oziq-ovqat do'koni" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("2/3-qadam")).toBeVisible()
    await page.getByRole("button", { name: "Menda bot bor" }).click()
    await page.getByLabel("Bot tokeni").fill(token)
    await bottomButton(page).click()
    await expect(page.getByText("3/3-qadam")).toBeVisible()
    await page.getByRole("button", { name: "Joylashuvni yuborish" }).click()
    await expect(page.getByText("Joylashuv olindi")).toBeVisible()
    await page.getByLabel(/Manzil/).fill("Guliston, Navoiy 20")
    await bottomButton(page).click() // «Ariza yuborish»
}

/** Zumda writes the bot's description: the shop's name and «Zumda asosida ishlaydi». */
async function expectZumdaDescriptions(token: string, shop: string, since: number): Promise<void> {
    const [about] = await callsOf("setMyShortDescription", since)
    expect(about?.token).toBe(token)
    expect(about?.body["short_description"]).toBe(
        `${shop}: uyga buyurtma bering. Zumda asosida ishlaydi`,
    )
    const [description] = await callsOf("setMyDescription", since)
    expect(String(description?.body["description"])).toContain("Zumda asosida ishlaydi")
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("a wrong token is refused and the wizard returns to the bot step", async ({ page }) => {
    const app = await openApp(page, { user: PEOPLE.newOwner, businessBot: true })
    await expect(page.getByRole("heading", { name: "Biznesingizni ulang" })).toBeVisible()
    await bottomButton(page).click() // «Boshlash»
    await expect(page.getByText("1/3-qadam")).toBeVisible()
    await apply(page, UNKNOWN_TOKEN, "Yangi Non")
    await expect(page.getByText("Token noto'g'ri. BotFather'dan to'liq nusxa oling.")).toBeVisible()
    await expect(page.getByText("2/3-qadam")).toBeVisible()
    await page.getByRole("button", { name: "@BotFather'ni ochish" }).click()
    expect((await app.calls()).find((c) => c.method === "openTelegramLink")?.args[0]).toBe(
        "https://t.me/BotFather",
    )
})

test("the application reaches the admin; the pending shop opens only for its owner", async ({
    page,
}) => {
    const app = await openApp(page, { user: PEOPLE.newOwner, businessBot: true })
    await bottomButton(page).click()
    const since = await lastSeq()
    await apply(page, NEW_BOT.token, "Yangi Non")
    // Straight into the new business: under review, and what is left before the first order.
    await expect(page.getByText("Ariza tekshirilmoqda")).toBeVisible()
    const ready = page.getByRole("region", { name: "Ishga tayyor" })
    await expect(ready).toContainText("To'lov usuli")
    await expect(ready).toContainText("1/5") // the location came with the application
    await app.back()
    await expect(page.getByText("Yangi Non")).toBeVisible()
    await expect(page.getByText("Tekshiruvda")).toBeVisible()

    await waitForMessage(PEOPLE.newOwner.id, "arizasi qabul qilindi", since)
    // The new bot at once wears Zumda's picture: the shop's name and the Zumda mark, as a JPEG.
    const photo = await waitForCall("setMyProfilePhoto", NEW_BOT.token, since)
    expect(photo.body["avatar"]).toMatchObject({ contentType: "image/jpeg" })
    const card = await waitForMessage(PEOPLE.admin.id, "Yangi biznes", since)
    expect(card.text).toContain("Yangi Non")
    expect(card.buttons.map((b) => b.text)).toEqual([
        "✅ Tasdiqlash",
        "❌ Rad etish",
        "📋 Arizani ochish",
    ])

    const [shop] = await myShops()
    await openApp(page, {
        user: PEOPLE.newOwner,
        query: `?shop=${shop?.slug ?? ""}`,
        signWith: NEW_BOT.token,
    })
    await expect(page.getByRole("button", { name: "Mening do'konim" })).toBeVisible()
    await openApp(page, {
        user: PEOPLE.customer,
        query: `?shop=${shop?.slug ?? ""}`,
        signWith: NEW_BOT.token,
    })
    // Customers already see it: the bot answers, the storefront opens, orders come later.
    await expect(page.getByRole("button", { name: "Mening do'konim" })).toBeHidden()
    await expect(page.getByText("Tez orada ochiladi").first()).toBeVisible()
})

test("the same bot cannot be connected twice", async () => {
    const response = await apiAs(PEOPLE.newOwner, "/platform/shops", {
        businessBot: true,
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
    const card = await waitForMessage(PEOPLE.admin.id, "Yangi biznes")
    const approve = card.buttons.find((b) => b.text === "✅ Tasdiqlash")?.callback_data ?? ""
    await businessChat().press(PEOPLE.stranger, approve)
    expect((await myShops())[0]?.status).toBe("pending")

    const since = await lastSeq()
    await businessChat().press(PEOPLE.admin, approve)
    await waitForMessage(PEOPLE.newOwner.id, "ishga tushdi", since)
    const [hook] = await callsOf("setWebhook", since)
    expect(hook?.token).toBe(NEW_BOT.token)
    expect(hook?.body["url"]).toBe(`http://localhost:8787/tg/${NEW_BOT.id}`)
    const [menu] = await callsOf("setChatMenuButton", since)
    const shop = (await myShops())[0]
    expect(JSON.stringify(menu?.body)).toContain(`?shop=${shop?.slug ?? ""}`)
    expect(shop?.status).toBe("active")
    await expectZumdaDescriptions(NEW_BOT.token, "Yangi Non", since)

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
    await expect(page.getByText("Katalog hali bo'sh")).toBeVisible()
})

test("a failed connection warns the admin; «Botni qayta ulash» in «Platforma» fixes it", async ({
    page,
}) => {
    const since = await lastSeq()
    await openAndApply(SECOND_OWNER, SECOND_BOT.token, "Ikkinchi Do'kon")
    const card = await waitForMessage(PEOPLE.admin.id, "Ikkinchi", since)
    await controlTelegram({ failWebhooks: true })
    await businessChat().press(PEOPLE.admin, card.buttons[0]?.callback_data ?? "")
    const warning = await waitForMessage(PEOPLE.admin.id, "bot ulanmadi", since)
    const query = appQueryOf(warning.buttons)
    const shopId = /admin=shop_([\w-]+)/.exec(query)?.[1] ?? ""
    expect(shopId).not.toBe("")

    await controlTelegram({ failWebhooks: false })
    const stranger = await apiAs(PEOPLE.stranger, `/admin/shops/${shopId}/reconnect`, {
        businessBot: true,
        method: "POST",
    })
    expect(stranger.status).toBe(403)

    const before = await lastSeq()
    await openApp(page, { user: PEOPLE.admin, businessBot: true, query })
    const shop = page.getByRole("listitem").filter({ hasText: "Ikkinchi Do'kon" })
    await shop.getByRole("button", { name: "Botni qayta ulash" }).click()
    await expect(page.getByText("Bot ulandi")).toBeVisible()
    await waitForCall("setWebhook", SECOND_BOT.token, before)
})

test("a rejected application: customers never see it; its owner fixes it and applies again", async ({
    page,
}) => {
    const since = await lastSeq()
    const third = "777100202:NEW-e2e-onboarding-token-uvwxyzabcd" // secret-scan: fake
    await openAndApply(THIRD_OWNER, third, "Uchinchi")
    const card = await waitForMessage(PEOPLE.admin.id, "Uchinchi", since)
    await businessChat().press(PEOPLE.admin, card.buttons[1]?.callback_data ?? "")
    await waitForMessage(THIRD_OWNER.id, "arizasi rad etildi", since)
    const rejected = (await myShops(THIRD_OWNER)).find((s) => s.name === "Uchinchi")
    expect(rejected?.status).toBe("disabled")
    await openApp(page, {
        user: PEOPLE.customer,
        query: `?shop=${rejected?.slug ?? ""}`,
        signWith: third,
    })
    await expect(page.getByRole("heading", { name: "Do'kon topilmadi" })).toBeVisible()

    await openApp(page, {
        user: THIRD_OWNER,
        query: `?shop=${rejected?.slug ?? ""}`,
        signWith: third,
    })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await expect(page.getByText("Ariza rad etildi")).toBeVisible()
    const again = await lastSeq()
    await page.getByRole("button", { name: "Tuzatib qayta yuborish" }).click()
    await expect(page.getByText("Ariza qayta yuborildi")).toBeVisible()
    await expect(page.getByText("Ariza tekshirilmoqda")).toBeVisible()
    const card2 = await waitForMessage(PEOPLE.admin.id, "Uchinchi", again)
    expect(card2.buttons[0]?.text).toBe("✅ Tasdiqlash")
})

test("admins hear about failures: a notification that did not go out", async () => {
    await controlTelegram({ broken: [PEOPLE.foodOwner.id] })
    const since = await lastSeq()
    await placeOrder(PEOPLE.customer, FOOD, [{ productId: "dev-food-p1", quantity: 1 }])
    const alert = await waitForMessage(PEOPLE.admin.id, "xabar yuborilmadi", since)
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
        businessBot: true,
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
