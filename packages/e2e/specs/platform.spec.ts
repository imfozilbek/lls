/**
 * Bots only notify; the work is done in the Mini App (owner's decision). «Platforma» in
 * Zumda | Business does what admins once did with commands; every message opens the app on what
 * it is about; a bot answers any text with the way into the app.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
import {
    businessChat,
    lastSeq,
    shopChat,
    waitForCall,
    waitForMessage,
} from "../support/telegram.js"
import { appQueryOf, openApp } from "../support/webapp.js"

// Fake tokens: the stand's Telegram accepts `<id>:NEW-...`. secret-scan: fake
const NEW_BOT = { id: 777100300, token: "777100300:NEW-e2e-platform-token-abcdefghij" } // secret-scan: fake
const APPLICANT = { id: 4105, first_name: "Malika", language_code: "uz" }

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("only an admin sees «Platforma» in «Mening bizneslarim»", async ({ page }) => {
    await openApp(page, { user: PEOPLE.foodOwner, businessBot: true })
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Platforma/ })).toBeHidden()
    const owner = await apiAs(PEOPLE.foodOwner, "/admin/shops?status=pending", {
        businessBot: true,
    })
    expect(owner.status).toBe(403)

    await openApp(page, { user: PEOPLE.admin, businessBot: true })
    await page.getByRole("button", { name: /Platforma/ }).click()
    await expect(page.getByRole("heading", { name: "Platforma" })).toBeVisible()
    await expect(page.getByText("Yangi arizalar yo'q")).toBeVisible()
})

test("an application: the message opens it in «Platforma», «Tasdiqlash» starts the shop", async ({
    page,
}) => {
    const since = await lastSeq()
    const applied = await apiAs(APPLICANT, "/platform/shops", {
        businessBot: true,
        method: "POST",
        json: {
            botToken: NEW_BOT.token,
            name: "Malika Pishiriq",
            type: "food",
            deliveryFee: 0,
            payoutCard: { number: "4111111111111111", holder: "Malika Yusupova" },
        },
    })
    expect(applied.status).toBe(201)
    const card = await waitForMessage(PEOPLE.admin.id, "Malika Pishiriq", since)
    const query = appQueryOf(card.buttons)
    expect(query).toContain("admin=shop_")

    await openApp(page, { user: PEOPLE.admin, businessBot: true, query })
    const application = page.getByRole("listitem").filter({ hasText: "Malika Pishiriq" })
    await expect(application).toContainText("Malika")
    await application.getByRole("button", { name: "Tasdiqlash" }).click()
    await expect(page.getByText("Malika Pishiriq ishga tushdi")).toBeVisible()
    await expect(page.getByText("Yangi arizalar yo'q")).toBeVisible()
    await waitForCall("setWebhook", NEW_BOT.token, since)
    const told = await waitForMessage(APPLICANT.id, "ishga tushdi", since)
    expect(appQueryOf(told.buttons)).toBe("?mode=business")
})

test("«Tumanlar»: a new district by its center, then a longer wait", async ({ page }) => {
    await openApp(page, {
        user: PEOPLE.admin,
        businessBot: true,
        query: "?mode=business&admin=districts",
    })
    await expect(page.getByRole("listitem").filter({ hasText: "Guliston" })).toBeVisible()
    await page.getByRole("button", { name: "Yangi tuman" }).click()
    const sheet = page.getByRole("dialog")
    await sheet.getByLabel("Tuman nomi").fill("Sirdaryo")
    await sheet.getByLabel("Markaz").fill("40.8400, 68.6600")
    await sheet.getByLabel("Radius, km").fill("12")
    await sheet.getByRole("button", { name: "Saqlash" }).click()
    await expect(page.getByText("Sirdaryo saqlandi")).toBeVisible()
    const sirdaryo = page.getByRole("listitem").filter({ hasText: "Sirdaryo" }).getByRole("button")
    await expect(sirdaryo).toContainText("12 km")

    await sirdaryo.click()
    await expect(sheet.getByLabel("Tuman nomi")).toHaveAttribute("readonly", "")
    await sheet.getByLabel("Kuryer kutish, daqiqa").fill("20")
    await sheet.getByRole("button", { name: "Saqlash" }).click()
    await expect(sirdaryo).toContainText("Kutish 20 daqiqa")
})

test("«Buyurtmani ochish»: the owner lands on the order, the customer on its tracking", async ({
    page,
}) => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    const card = await waitForMessage(PEOPLE.foodOwner.id, `#${order.number}`, since)
    // The owner's card: «Pul keldi, qabul qilish», «Bekor qilish», then the order in the app.
    expect(card.buttons.map((b) => b.callback_data ?? "app")).toEqual([
        `p:${order.id}`,
        `x:${order.id}`,
        "app",
    ])
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, query: appQueryOf(card.buttons) })
    const focused = page.getByRole("region", { name: "Xabardagi buyurtma" })
    await expect(focused).toContainText(`Buyurtma #${order.number}`)
    await focused.getByRole("button", { name: "Yopish" }).click()
    await expect(focused).toBeHidden()

    const toPay = await waitForMessage(PEOPLE.customer.id, "o'tkazing", since)
    await openApp(page, { user: PEOPLE.customer, shop: FOOD, query: appQueryOf(toPay.buttons) })
    await expect(page.getByText(`Buyurtma #${order.number}`)).toBeVisible()
})

test("a bot answers any text with the way into the app; only /start is a command", async () => {
    const since = await lastSeq()
    await businessChat().send(PEOPLE.admin, "/network")
    const business = await waitForMessage(PEOPLE.admin.id, "ish esa ilovada", since)
    expect(appQueryOf(business.buttons)).toBe("?mode=business")
    await shopChat(FOOD).send(PEOPLE.customer, "salom")
    const shop = await waitForMessage(PEOPLE.customer.id, "ish esa ilovada", since)
    expect(appQueryOf(shop.buttons)).toBe(`?shop=${FOOD}`)
})
