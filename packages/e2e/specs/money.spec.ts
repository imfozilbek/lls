/**
 * Money: customers pay only by transfer to the shop's card, before the shop starts. «Я перевёл»,
 * «Деньги пришли, принять», one «Доставил», refunds, a shop without a card, the «Деньги» tab,
 * the CSV report and the QR poster in the owner's chat, hours per day.
 */
import { expect, test } from "@playwright/test"
import jsQR from "jsqr"
import { PNG } from "pngjs"

import { runSql } from "../stand/seed.js"
import {
    FOOD,
    GROCERY,
    PEOPLE,
    apiAs,
    payAndAccept,
    placeOrder,
    resetStand,
} from "../support/stand.js"
import {
    callsOf,
    courierChat,
    lastSeq,
    messagesTo,
    shopChat,
    waitForMessage,
} from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { RecordedFile } from "../stand/fake-telegram.js"
import type { Page } from "@playwright/test"

const COURIER_ID = "dev-food-courier"
const CARD = "8600 1234 5678 9012"
const P1 = "dev-food-p1"

interface MoneyReport {
    totals: Record<string, number>
    awaiting: { id: string }[]
    refunds: { id: string }[]
}

async function owner(path: string, json?: object, method = "PATCH"): Promise<Response> {
    return apiAs(PEOPLE.foodOwner, path, { shop: FOOD, method, json })
}

async function report(): Promise<MoneyReport> {
    return (await (
        await apiAs(PEOPLE.foodOwner, "/owner/money", { shop: FOOD })
    ).json()) as MoneyReport
}

async function openOwner(page: Page, shop = FOOD, user = PEOPLE.foodOwner): Promise<void> {
    await openApp(page, { user, shop })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
}

async function openMoney(page: Page): Promise<void> {
    await openOwner(page)
    await page.getByRole("tab", { name: "Pul" }).click()
    await expect(page.getByText("Tushum").first()).toBeVisible()
}

const block = (page: Page, title: string): ReturnType<Page["locator"]> =>
    page.locator("section").filter({ has: page.getByRole("heading", { name: title }) })

async function documentsTo(chatId: number, since: number): Promise<RecordedFile[]> {
    return (await callsOf("sendDocument", since))
        .filter((c) => Number(c.body["chat_id"]) === chatId)
        .map((c) => c.body["document"] as RecordedFile)
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("checkout shows the card; «Я перевёл»; the owner «Деньги пришли, принять»", async ({
    page,
    context,
}) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await shopChat(FOOD).shareContact(PEOPLE.customer, "+998901234567")
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await page.getByRole("textbox", { name: "Manzil" }).fill("Mustaqillik 5")

    // No choice to make: only a transfer to the shop's card.
    await expect(page.getByRole("radio")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "O'tkazma orqali to'lov" })).toBeVisible()
    await expect(page.getByText(CARD)).toBeVisible()
    await expect(page.getByText("RUSTAM KARIMOV")).toBeVisible()
    await page.getByRole("button", { name: "Raqamni nusxalash" }).click()
    await expect(page.getByText("Karta raqami nusxalandi")).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("8600123456789012")
    await expect(page.getByText(/55\s000\sso'm ni shu kartaga o'tkazing/)).toBeVisible()

    const placed = await lastSeq()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toBeVisible()
    await expect(page.getByText("O'tkazma kutilmoqda")).toBeVisible()
    // The card stays at hand on the order screen, and the bot sends it too.
    await expect(page.getByText(CARD)).toBeVisible()
    const toPay = await waitForMessage(PEOPLE.customer.id, "o'tkazing", placed)
    expect(toPay.text).toContain(CARD)
    expect(toPay.text).toMatch(/55\s000/)
    const card = await waitForMessage(PEOPLE.foodOwner.id, "Kartaga o'tkazma kutilmoqda", placed)
    expect(card.buttons.map((b) => b.text)).toEqual([
        "💳 Pul keldi, qabul qilish",
        "❌ Bekor qilish",
    ])

    const sent = await lastSeq()
    await page.getByRole("button", { name: "O'tkazdim" }).click()
    await expect(page.getByText("Do'kon o'tkazmani tekshirmoqda").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "O'tkazdim" })).toBeHidden()
    await waitForMessage(PEOPLE.foodOwner.id, /<b>55\s000[^<]*<\/b> o'tkazdi/, sent)

    expect((await report()).awaiting).toHaveLength(1)
    const accepted = await lastSeq()
    await openMoney(page)
    const check = block(page, "Mijozlar o'tkazdi, kartani tekshiring")
    await expect(check).toContainText(/55\s000/)
    await check.getByRole("button", { name: "Pul keldi, qabul qilish" }).click()
    await expect(check).toBeHidden()
    await waitForMessage(PEOPLE.customer.id, "To'lov keldi", accepted)
    expect((await report()).awaiting).toEqual([])
})

test("not paid, not started: «Принять» is refused; the order card accepts with the money", async ({
    page,
}) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    const early = await owner(`/owner/orders/${order.id}`, { status: "accepted" })
    expect(early.status).toBe(422)
    expect(await early.json()).toMatchObject({ error: { code: "PAYMENT_REQUIRED" } })

    await openOwner(page)
    const card = page
        .locator("li")
        .filter({ has: page.getByText(`Buyurtma #${order.number}`, { exact: true }) })
    await expect(card).toContainText("O'tkazma kutilmoqda")
    await expect(card.getByRole("button", { name: "Qabul qilish", exact: true })).toHaveCount(0)
    await card.getByRole("button", { name: "Pul keldi, qabul qilish" }).click()
    await expect(card).toContainText("To'langan")
    await expect(card.getByRole("button", { name: "Tayyorlashni boshlash" })).toBeVisible()
})

test("from the bot: «Деньги пришли, принять», then one «Доставил» for the courier", async () => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 2 }])
    const card = await waitForMessage(PEOPLE.foodOwner.id, `#${order.number}`, since)
    const paid = card.buttons.find((b) => b.callback_data === `p:${order.id}`)
    expect(paid?.text).toBe("💳 Pul keldi, qabul qilish")
    await shopChat(FOOD).press(PEOPLE.foodOwner, paid?.callback_data ?? "", card.seq)
    await expect
        .poll(async () => {
            const read = await apiAs(PEOPLE.customer, `/orders/${order.id}`, { shop: FOOD })
            return ((await read.json()) as { status: string }).status
        })
        .toBe("accepted")

    expect(
        (await owner(`/owner/orders/${order.id}/courier`, { courierId: COURIER_ID }, "PUT")).status,
    ).toBe(200)
    for (const status of ["preparing", "ready"]) {
        expect((await owner(`/owner/orders/${order.id}`, { status })).status).toBe(200)
    }
    const picked = await apiAs(PEOPLE.courier, `/courier/orders/${order.id}`, {
        courierBot: true,
        method: "PATCH",
        json: { status: "picked_up" },
    })
    expect(picked.status).toBe(200)
    let delivered: { callback_data?: string }[] = []
    await expect
        .poll(async () => {
            const courierCard = (await messagesTo(PEOPLE.courier.id, since))
                // The "ready" ping may land after the edit: read the card itself.
                .filter((m) => m.method === "editMessageText")
                .filter((m) => m.text.includes(`#${order.number}`))
                .at(-1)
            delivered =
                courierCard?.buttons.filter((b) => b.callback_data?.includes(":delivered")) ?? []
            return delivered.map((b) => b.callback_data)
        })
        .toEqual([`a:${order.id}:delivered`])
    await courierChat().press(PEOPLE.courier, delivered[0]?.callback_data ?? "")
    await waitForMessage(PEOPLE.customer.id, `#${order.number} buyurtmangiz yetkazildi`, since)
})

test("a paid order cancelled: owed back until «Вернул»", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    await owner(`/owner/orders/${order.id}`, { status: "cancelled" })
    await openMoney(page)
    const refunds = block(page, "Mijozlarga qaytarish")
    await expect(refunds).toContainText(/55\s000/)
    await refunds.getByRole("button", { name: "Qaytardim" }).click()
    await expect(refunds).toBeHidden()
    await expect(
        page.getByText("Barcha o'tkazmalar tekshirildi, qaytariladigan pul yo'q."),
    ).toBeVisible()
})

test("the day adds up to the sum; the CSV report arrives in the owner's chat", async ({ page }) => {
    const today = await report()
    // Delivered today: one order for 100 000, paid by transfer before cooking. The other two
    // are paid and accepted but not delivered: money counts on delivery.
    expect(today.totals).toMatchObject({ placed: 3, delivered: 1, cancelled: 1, paid: 100_000 })
    expect((today.totals["goods"] ?? 0) + (today.totals["delivery"] ?? 0)).toBe(100_000)

    const since = await lastSeq()
    await openMoney(page)
    await expect(page.getByText(/100\s000/).first()).toBeVisible()
    await expect(page.getByText("O'tkazmalar orqali olindi")).toBeVisible()
    await expect(page.getByText(/Naqd/)).toHaveCount(0)
    await page.getByRole("tab", { name: "Shu oy" }).click()
    await page.getByRole("button", { name: "Excel uchun hisobot" }).click()
    await expect(page.getByText("Hisobot bot bilan chatga yuborildi")).toBeVisible()
    const [csv] = await documentsTo(PEOPLE.foodOwner.id, since)
    expect(csv?.name).toMatch(/^osh-markaz-dev-.+\.csv$/)
    const bytes = Buffer.from(csv?.base64 ?? "", "base64")
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = bytes.toString("utf8").slice(1).trim().split("\r\n")
    // Header + the 4 orders of this file, the cancelled one too.
    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain("To'lov holati")
    expect(lines[0]).not.toContain("To'lov usuli")
})

test("many cards: the owner adds one, makes it the payment card; old orders keep theirs", async ({
    page,
}) => {
    const before = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    await openOwner(page)
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    const cards = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Kartalar" }) })
    await expect(cards.getByRole("listitem")).toHaveCount(1)
    await expect(cards.getByRole("listitem").first()).toContainText("To'lov uchun")
    await cards.getByRole("button", { name: "Karta qo'shish" }).click()
    await page.getByLabel("Karta raqami").fill("5614 6812 3456 7893")
    await page.getByLabel("Kartadagi ism").fill("Malika Karimova")
    await cards.getByRole("button", { name: "Kartani saqlash" }).click()
    await expect(page.getByText("Karta qo'shildi")).toBeVisible()
    const second = cards.getByRole("listitem").filter({ hasText: "5614 6812 3456 7893" })
    await expect(second).not.toContainText("To'lov uchun")
    await second.getByRole("button", { name: "Shu kartaga to'lansin" }).click()
    await expect(second).toContainText("To'lov uchun")
    // The payment card has no «delete»; the old one does.
    await expect(second.getByRole("button", { name: "Kartani o'chirish" })).toHaveCount(0)
    const first = cards.getByRole("listitem").filter({ hasText: CARD })
    await expect(first.getByRole("button", { name: "Kartani o'chirish" })).toBeVisible()

    // A new order is shown the new card; the earlier one keeps the card it was shown.
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Buyurtmalarim" }).click()
    await page.getByRole("button", { name: new RegExp(`Buyurtma #${before.number}`) }).click()
    await expect(page.getByText(CARD)).toBeVisible()
    const after = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    const read = await apiAs(PEOPLE.customer, `/orders/${after.id}`, { shop: FOOD })
    expect(
        ((await read.json()) as { payment: { card?: { number: string } } }).payment.card,
    ).toMatchObject({
        number: "5614681234567893",
    })
})

test("no card, no orders: the storefront waits; the owner adds the card from the banner", async ({
    page,
}) => {
    // A shop that never added a card (as before cards were required).
    runSql(
        `DELETE FROM payout_cards WHERE business_id = 'dev-grocery';
         UPDATE businesses SET payout_card_number = NULL, payout_card_holder = NULL,
            payment_card_id = NULL WHERE id = 'dev-grocery';`,
    )
    const refused = await apiAs(PEOPLE.customer, "/orders", {
        shop: GROCERY,
        method: "POST",
        json: { items: [{ productId: "dev-grocery-p1", quantity: 500 }], address: "Navoiy 12" },
    })
    expect(refused.status).toBe(422)
    expect(await refused.json()).toMatchObject({ error: { code: "NO_PAYOUT_CARD" } })

    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    await expect(page.getByText("Tez orada buyurtma qabul qila boshlaydi")).toBeVisible()

    await openOwner(page, GROCERY, PEOPLE.groceryOwner)
    const banner = page.getByRole("button", { name: /O'tkazmalar uchun karta qo'shing/ })
    await expect(banner).toBeVisible()
    await banner.click()
    // No card yet: the form is already open.
    await page.getByLabel("Karta raqami").fill("5614681234567893")
    await page.getByLabel("Kartadagi ism").fill("Sardor Yusupov")
    await page.getByRole("button", { name: "Kartani saqlash" }).click()
    await expect(page.getByText("Karta qo'shildi")).toBeVisible()
    await expect(banner).toBeHidden()
    const shop = (await (await apiAs(PEOPLE.customer, "/shop", { shop: GROCERY })).json()) as {
        hasPayoutCard: boolean
    }
    expect(shop.hasPayoutCard).toBe(true)
})

test("the QR poster arrives as a PNG and its code opens the shop bot", async ({ page }) => {
    const since = await lastSeq()
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    await page.getByRole("button", { name: "Chop etish uchun QR-kod" }).click()
    await expect(page.getByText("Plakat bot bilan chatga yuborildi")).toBeVisible()
    const [poster] = await documentsTo(PEOPLE.foodOwner.id, since)
    expect(poster?.contentType).toBe("image/png")
    const png = PNG.sync.read(Buffer.from(poster?.base64 ?? "", "base64"))
    expect([png.width, png.height]).toEqual([1080, 1350])
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    expect(code?.data).toBe("https://t.me/osh_markaz_dev_bot")
})

test("hours per day: Monday off, Tuesday 9–18, then Monday's hours for every day", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    const always = page.getByRole("switch", { name: "24/7 ochiq" })
    if ((await always.getAttribute("aria-checked")) === "true") {
        await always.click()
    }
    await page.getByRole("switch", { name: "Du", exact: true }).click()
    await expect(page.getByText("Dam olish")).toBeVisible()
    await page.getByLabel("Se · Ochiladi").fill("09:00")
    await page.getByLabel("Se · Yopiladi").fill("18:00")
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()

    const shop = (await (await apiAs(PEOPLE.foodOwner, "/owner/shop", { shop: FOOD })).json()) as {
        workingHours: Record<string, { open: string; close: string }> | null
    }
    expect(shop.workingHours?.["mon"]).toBeUndefined()
    expect(shop.workingHours?.["tue"]).toEqual({ open: "09:00", close: "18:00" })

    // Back to every day, Monday 08:00–23:00 copied to the rest.
    await page.getByRole("switch", { name: "Du", exact: true }).click()
    await page.getByLabel("Du · Ochiladi").fill("08:00")
    await page.getByLabel("Du · Yopiladi").fill("23:00")
    await page.getByRole("button", { name: "Hamma kunlarga dushanbadagidek" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    const again = (await (await apiAs(PEOPLE.foodOwner, "/owner/shop", { shop: FOOD })).json()) as {
        workingHours: Record<string, { open: string; close: string }>
    }
    expect(Object.values(again.workingHours)).toHaveLength(7)
    expect(new Set(Object.values(again.workingHours).map((r) => `${r.open}-${r.close}`))).toEqual(
        new Set(["08:00-23:00"]),
    )
})
