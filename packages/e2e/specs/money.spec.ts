/**
 * Money: customers pay only by transfer to the shop's card, before the shop starts. «Я перевёл»,
 * «Деньги пришли — принять», one «Доставил», refunds, a shop without a card, the «Деньги» tab,
 * the CSV report and the QR poster in the owner's chat, hours per day.
 */
import { expect, test } from "@playwright/test"
import jsQR from "jsqr"
import { PNG } from "pngjs"

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
    await page.getByRole("button", { name: "Мой магазин" }).click()
}

async function openMoney(page: Page): Promise<void> {
    await openOwner(page)
    await page.getByRole("tab", { name: "Деньги" }).click()
    await expect(page.getByText("Выручка").first()).toBeVisible()
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

test("checkout shows the card; «Я перевёл»; the owner «Деньги пришли — принять»", async ({
    page,
    context,
}) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await shopChat(FOOD).shareContact(PEOPLE.customer, "+998901234567")
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Добавить: To'y oshi" }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await page.getByRole("textbox", { name: "Адрес" }).fill("Mustaqillik 5")

    // No choice to make: only a transfer to the shop's card.
    await expect(page.getByRole("radio")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Оплата переводом" })).toBeVisible()
    await expect(page.getByText(CARD)).toBeVisible()
    await expect(page.getByText("RUSTAM KARIMOV")).toBeVisible()
    await page.getByRole("button", { name: "Скопировать номер" }).click()
    await expect(page.getByText("Номер карты скопирован")).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("8600123456789012")
    await expect(page.getByText(/Переведите 55\s000/)).toBeVisible()

    const placed = await lastSeq()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Заказ отправлен!" })).toBeVisible()
    await expect(page.getByText("Ждём перевод")).toBeVisible()
    // The card stays at hand on the order screen, and the bot sends it too.
    await expect(page.getByText(CARD)).toBeVisible()
    const toPay = await waitForMessage(PEOPLE.customer.id, "Переведите", placed)
    expect(toPay.text).toContain(CARD)
    expect(toPay.text).toMatch(/55\s000/)
    const card = await waitForMessage(PEOPLE.foodOwner.id, "Ждём перевод на карту", placed)
    expect(card.buttons.map((b) => b.text)).toEqual(["💳 Деньги пришли — принять", "❌ Отменить"])

    const sent = await lastSeq()
    await page.getByRole("button", { name: "Я перевёл" }).click()
    await expect(page.getByText("Магазин проверяет перевод").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Я перевёл" })).toBeHidden()
    await waitForMessage(PEOPLE.foodOwner.id, /Клиент перевёл <b>55\s000/, sent)

    expect((await report()).awaiting).toHaveLength(1)
    const accepted = await lastSeq()
    await openMoney(page)
    const check = block(page, "Клиенты перевели — проверьте карту")
    await expect(check).toContainText(/55\s000/)
    await check.getByRole("button", { name: "Деньги пришли — принять" }).click()
    await expect(check).toBeHidden()
    await waitForMessage(PEOPLE.customer.id, "Оплата получена", accepted)
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
        .filter({ has: page.getByText(`Заказ #${order.number}`, { exact: true }) })
    await expect(card).toContainText("Ждём перевод")
    await expect(card.getByRole("button", { name: "Принять", exact: true })).toHaveCount(0)
    await card.getByRole("button", { name: "Деньги пришли — принять" }).click()
    await expect(card).toContainText("Оплачено")
    await expect(card.getByRole("button", { name: "Начать готовить" })).toBeVisible()
})

test("from the bot: «Деньги пришли — принять», then one «Доставил» for the courier", async () => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 2 }])
    const card = await waitForMessage(PEOPLE.foodOwner.id, `#${order.number}`, since)
    const paid = card.buttons.find((b) => b.callback_data === `p:${order.id}`)
    expect(paid?.text).toBe("💳 Деньги пришли — принять")
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
    await waitForMessage(PEOPLE.customer.id, `Заказ #${order.number} доставлен`, since)
})

test("a paid order cancelled: owed back until «Вернул»", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    await owner(`/owner/orders/${order.id}`, { status: "cancelled" })
    await openMoney(page)
    const refunds = block(page, "Вернуть клиентам")
    await expect(refunds).toContainText(/55\s000/)
    await refunds.getByRole("button", { name: "Вернул" }).click()
    await expect(refunds).toBeHidden()
    await expect(page.getByText("Все переводы проверены, возвращать нечего.")).toBeVisible()
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
    await expect(page.getByText("Получено переводами")).toBeVisible()
    await expect(page.getByText(/Наличн/)).toHaveCount(0)
    await page.getByRole("tab", { name: "Этот месяц" }).click()
    await page.getByRole("button", { name: "Отчёт для Excel" }).click()
    await expect(page.getByText("Отчёт отправлен в чат с ботом")).toBeVisible()
    const [csv] = await documentsTo(PEOPLE.foodOwner.id, since)
    expect(csv?.name).toMatch(/^osh-markaz-dev-.+\.csv$/)
    const bytes = Buffer.from(csv?.base64 ?? "", "base64")
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = bytes.toString("utf8").slice(1).trim().split("\r\n")
    // Header + the 4 orders of this file, the cancelled one too.
    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain("Оплата")
    expect(lines[0]).not.toContain("Способ оплаты")
})

test("no card, no orders: the storefront waits; the owner adds the card from the banner", async ({
    page,
}) => {
    const removed = await apiAs(PEOPLE.groceryOwner, "/owner/shop", {
        shop: GROCERY,
        method: "PATCH",
        json: { payoutCard: null },
    })
    expect(removed.status).toBe(200)
    const refused = await apiAs(PEOPLE.customer, "/orders", {
        shop: GROCERY,
        method: "POST",
        json: { items: [{ productId: "dev-grocery-p1", quantity: 500 }], address: "Navoiy 12" },
    })
    expect(refused.status).toBe(422)
    expect(await refused.json()).toMatchObject({ error: { code: "NO_PAYOUT_CARD" } })

    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    await expect(page.getByText("Скоро начнёт принимать заказы")).toBeVisible()

    await openOwner(page, GROCERY, PEOPLE.groceryOwner)
    const banner = page.getByRole("button", { name: /Добавьте карту для переводов/ })
    await expect(banner).toBeVisible()
    await banner.click()
    await page.getByLabel("Номер карты").fill("5614681234567893")
    await page.getByLabel("Имя на карте").fill("Sardor Yusupov")
    await bottomButton(page).click()
    await expect(page.getByText("Сохранено")).toBeVisible()
    await expect(banner).toBeHidden()
    const shop = (await (await apiAs(PEOPLE.customer, "/shop", { shop: GROCERY })).json()) as {
        hasPayoutCard: boolean
        isOpen: boolean
    }
    expect(shop.hasPayoutCard).toBe(true)
})

test("the QR poster arrives as a PNG and its code opens the shop bot", async ({ page }) => {
    const since = await lastSeq()
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Мой магазин" }).click()
    await page.getByRole("tab", { name: "Настройки" }).click()
    await page.getByRole("button", { name: "QR-код для печати" }).click()
    await expect(page.getByText("Плакат отправлен в чат с ботом")).toBeVisible()
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
    await page.getByRole("button", { name: "Мой магазин" }).click()
    await page.getByRole("tab", { name: "Настройки" }).click()
    const always = page.getByRole("switch", { name: "Круглосуточно" })
    if ((await always.getAttribute("aria-checked")) === "true") {
        await always.click()
    }
    await page.getByRole("switch", { name: "Пн", exact: true }).click()
    await expect(page.getByText("Выходной")).toBeVisible()
    await page.getByLabel("Вт · Открывается").fill("09:00")
    await page.getByLabel("Вт · Закрывается").fill("18:00")
    await bottomButton(page).click()
    await expect(page.getByText("Сохранено")).toBeVisible()

    const shop = (await (await apiAs(PEOPLE.foodOwner, "/owner/shop", { shop: FOOD })).json()) as {
        workingHours: Record<string, { open: string; close: string }> | null
    }
    expect(shop.workingHours?.["mon"]).toBeUndefined()
    expect(shop.workingHours?.["tue"]).toEqual({ open: "09:00", close: "18:00" })

    // Back to every day, Monday 08:00–23:00 copied to the rest.
    await page.getByRole("switch", { name: "Пн", exact: true }).click()
    await page.getByLabel("Пн · Открывается").fill("08:00")
    await page.getByLabel("Пн · Закрывается").fill("23:00")
    await page.getByRole("button", { name: "Как в понедельник для всех дней" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Сохранено")).toBeVisible()
    const again = (await (await apiAs(PEOPLE.foodOwner, "/owner/shop", { shop: FOOD })).json()) as {
        workingHours: Record<string, { open: string; close: string }>
    }
    expect(Object.values(again.workingHours)).toHaveLength(7)
    expect(new Set(Object.values(again.workingHours).map((r) => `${r.open}-${r.close}`))).toEqual(
        new Set(["08:00-23:00"]),
    )
})
