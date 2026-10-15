/**
 * Bots only notify; the work is done in the Mini App (owner's decision). «Platforma» in
 * Zumda | Business does what admins once did with commands; every message opens the app on what
 * it is about; a bot answers any text with the way into the app.
 */
import { expect, test } from "@playwright/test"

import { businessBot, courierBot } from "../stand/config.js"
import { runSql } from "../stand/seed.js"
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
const OWNER_PHONE = "+998905550001"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("only an admin sees «Platforma» in «Mening bizneslarim»", async ({ page }) => {
    const owner = await openApp(page, { user: PEOPLE.foodOwner, businessBot: true })
    // One business: the owner lands right in it; back leads to the list.
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    await owner.back()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Platforma/ })).toBeHidden()
    const forbidden = await apiAs(PEOPLE.foodOwner, "/admin/shops?status=pending", {
        businessBot: true,
    })
    expect(forbidden.status).toBe(403)

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
    await expect(page.getByRole("listitem").filter({ hasText: "Yakkabog'" })).toBeVisible()
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
    // The name is the district's key: shown as words, never a field.
    await expect(sheet.getByText("Sirdaryo", { exact: true })).toBeVisible()
    await expect(sheet.getByLabel("Tuman nomi")).toHaveCount(0)
    await sheet.getByLabel("Kuryer kutish, daqiqa").fill("20")
    await sheet.getByRole("button", { name: "Saqlash" }).click()
    await expect(sirdaryo).toContainText("Kutish 20 daqiqa")
})

test("«Qo'llanma»: the couriers' guide goes to each courier once, from Zumda | Kuryer", async ({
    page,
}) => {
    const since = await lastSeq()
    await openApp(page, { user: PEOPLE.admin, businessBot: true })
    await page.getByRole("button", { name: /Platforma/ }).click()
    await page.getByRole("tab", { name: "Qo'llanma" }).click()
    const couriers = page.getByRole("listitem").filter({ hasText: "Kuryerlar" })
    await expect(couriers).toContainText(/kishi kutmoqda/)
    await couriers.getByRole("button", { name: "Yuborish" }).click()
    // The result stays on the row, not only in the passing toast.
    await expect(couriers.getByText(/Yuborildi: \d+, yetmadi: 0/)).toBeVisible()
    await expect(couriers).toContainText("Hammasi oldi")
    await expect(couriers.getByRole("button", { name: "Yuborish" })).toHaveCount(0)

    const guide = await waitForMessage(PEOPLE.courier.id, "kuryer uchun", since)
    expect(guide.method).toBe("sendVideo")
    expect(guide.video).toBe("http://localhost:5173/welcome/kuryer.mp4")
    expect(guide.buttons[0]?.web_app?.url).toContain("mode=courier")
})

test("«Raqam so'rash»: the owner and the courier get one button; the owner's number serves the shop", async ({
    page,
}) => {
    // The food shop has no number of its own, its owner none in Zumda, its courier none either.
    runSql(
        `UPDATE businesses SET contact_phone = NULL WHERE slug = '${FOOD}';
         UPDATE customers SET phone = NULL WHERE telegram_id = ${PEOPLE.foodOwner.id};
         UPDATE courier_profiles SET phone = NULL WHERE telegram_id = ${PEOPLE.courier.id}`,
    )
    const since = await lastSeq()
    await openApp(page, { user: PEOPLE.admin, businessBot: true })
    await page.getByRole("button", { name: /Platforma/ }).click()
    await page.getByRole("tab", { name: "Bizneslar" }).click()
    const card = page.getByRole("region", { name: "Raqamsiz" })
    await expect(card).toContainText(/Do'kon egalari: \d+ · Kuryerlar: \d+/)
    await card.getByRole("button", { name: "Raqam so'rash" }).click()
    await expect(card.getByText(/So'raldi: \d+, yetmadi: \d+/)).toBeVisible()
    // Once a day: the button is gone until tomorrow.
    await expect(card).toContainText("Bugun so'raldi")
    await expect(card.getByRole("button", { name: "Raqam so'rash" })).toHaveCount(0)

    const toOwner = await waitForMessage(PEOPLE.foodOwner.id, "buyurtma qabul qilmayapti", since)
    expect(toOwner.token).toBe(businessBot().token)
    expect(toOwner.replyButtons).toEqual([
        { text: "📱 Raqamimni yuborish", request_contact: true },
        { text: "✏️ Boshqa raqam yozaman" },
    ])
    const toCourier = await waitForMessage(PEOPLE.courier.id, "Raqamsiz buyurtma kelmaydi", since)
    expect(toCourier.token).toBe(courierBot().token)
    expect(toCourier.replyButtons[0]).toMatchObject({ request_contact: true })

    // One button: the owner's own number, and the shop takes orders with it.
    await businessChat().shareContact(PEOPLE.foodOwner, OWNER_PHONE)
    await waitForMessage(PEOPLE.foodOwner.id, "Raqamingiz saqlandi", since)
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute(
        "href",
        `tel:${OWNER_PHONE}`,
    )

    runSql(
        `UPDATE businesses SET contact_phone = '+998901234501' WHERE slug = '${FOOD}';
         UPDATE courier_profiles SET phone = '+998901112233' WHERE telegram_id = ${PEOPLE.courier.id}`,
    )
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
