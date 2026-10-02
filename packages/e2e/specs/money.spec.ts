/**
 * Money: cash or a transfer to the shop's card, what the courier holds, debts, refunds,
 * the «Деньги» tab, the CSV report and the QR poster in the owner's chat, hours per day.
 */
import { expect, test } from "@playwright/test"
import jsQR from "jsqr"
import { PNG } from "pngjs"

import { FOOD, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
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
import type { PlacedOrder } from "../support/stand.js"
import type { Page } from "@playwright/test"

const COURIER_ID = "dev-food-courier"
const CARD = "8600 1234 5678 9012"
const P1 = "dev-food-p1"

interface MoneyReport {
    totals: Record<string, number>
    awaiting: { id: string }[]
    debts: { id: string }[]
    refunds: { id: string }[]
    couriers: { courierId: string; onHand: number }[]
}

async function owner(path: string, json?: object, method = "PATCH"): Promise<Response> {
    return apiAs(PEOPLE.foodOwner, path, { shop: FOOD, method, json })
}

async function report(): Promise<MoneyReport> {
    return (await (
        await apiAs(PEOPLE.foodOwner, "/owner/money", { shop: FOOD })
    ).json()) as MoneyReport
}

/** Accepted, given to the courier, cooked, picked up: the courier is at the door. */
async function atTheDoor(order: PlacedOrder): Promise<void> {
    for (const status of ["accepted", "preparing", "ready"]) {
        expect((await owner(`/owner/orders/${order.id}`, { status })).status).toBe(200)
        if (status === "accepted") {
            const assign = await owner(
                `/owner/orders/${order.id}/courier`,
                { courierId: COURIER_ID },
                "PUT",
            )
            expect(assign.status).toBe(200)
        }
    }
    const picked = await apiAs(PEOPLE.courier, `/courier/orders/${order.id}`, {
        courierBot: true,
        method: "PATCH",
        json: { status: "picked_up" },
    })
    expect(picked.status).toBe(200)
}

async function openMoney(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Мой магазин" }).click()
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

test("transfer: the customer sees the card, the owner confirms, the customer is told", async ({
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

    await page.getByRole("radio", { name: /Переводом на карту/ }).click()
    await expect(page.getByText(CARD)).toBeVisible()
    await expect(page.getByText("RUSTAM KARIMOV")).toBeVisible()
    await page.getByRole("button", { name: "Скопировать номер" }).click()
    await expect(page.getByText("Номер карты скопирован")).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("8600123456789012")
    await expect(page.getByText(/Переведите 55\s000/)).toBeVisible()

    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Заказ отправлен!" })).toBeVisible()
    await expect(page.getByText("Ждём перевод")).toBeVisible()
    // The card stays at hand on the order screen until the transfer is confirmed.
    await expect(page.getByText(CARD)).toBeVisible()

    const awaiting = await report()
    expect(awaiting.awaiting).toHaveLength(1)
    const since = await lastSeq()
    await openMoney(page)
    const confirm = block(page, "Подтвердите переводы")
    await expect(confirm).toContainText(/55\s000/)
    await confirm.getByRole("button", { name: "Деньги пришли" }).click()
    await expect(confirm).toBeHidden()
    await waitForMessage(PEOPLE.customer.id, "получена", since)
    expect((await report()).totals["awaiting"]).toBe(0)
})

test("cash at the door: on the courier's hands until the owner takes it", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 2 }])
    await atTheDoor(order)
    await openApp(page, { user: PEOPLE.courier, courierBot: true })
    await expect(page.getByText(/Взять с клиента/)).toBeVisible()
    await page.getByRole("button", { name: "Доставил" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Наличными" }).click()
    await expect(page.getByText(/На руках: 100\s000/)).toBeVisible()

    await openMoney(page)
    const couriers = block(page, "Наличные у доставщиков")
    await expect(couriers).toContainText("Jasur")
    await couriers.getByRole("button", { name: "Принял деньги" }).click()
    const sheet = page.getByRole("dialog")
    await sheet.getByRole("textbox").fill("60000")
    await sheet.getByRole("button", { name: "Принял деньги" }).click()
    await expect(couriers).toContainText(/40\s000/)
    // More than the courier holds is refused before it reaches the Worker.
    await couriers.getByRole("button", { name: "Принял деньги" }).click()
    await sheet.getByRole("textbox").fill("50000")
    await expect(sheet.getByRole("button", { name: "Принял деньги" })).toBeDisabled()
    await sheet.getByRole("textbox").fill("40000")
    await sheet.getByRole("button", { name: "Принял деньги" }).click()
    await expect(couriers).toBeHidden()

    await openApp(page, { user: PEOPLE.courier, courierBot: true })
    await expect(page.getByRole("heading", { name: "Мои доставки" })).toBeVisible()
    await expect(page.getByText(/На руках/)).toBeHidden()
})

test("the bot card: three «Доставил» buttons; a transfer at the door waits for the owner", async () => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    await atTheDoor(order)
    // The courier's card is edited in place when the order is picked up.
    let delivered: { callback_data?: string }[] = []
    await expect
        .poll(async () => {
            const card = (await messagesTo(PEOPLE.courier.id, since))
                // The "ready" ping may land after the edit: read the card itself.
                .filter((m) => m.method === "editMessageText")
                .filter((m) => m.text.includes(`#${order.number}`))
                .at(-1)
            delivered = card?.buttons.filter((b) => b.callback_data?.includes(":delivered")) ?? []
            return delivered.length
        })
        .toBe(3)
    expect(delivered.map((b) => b.callback_data?.split(":").at(-1))).toEqual([
        "cash",
        "card_transfer",
        "later",
    ])
    const transfer = delivered.find((b) => b.callback_data?.endsWith(":card_transfer"))
    await courierChat().press(PEOPLE.courier, transfer?.callback_data ?? "")
    await expect.poll(async () => (await report()).awaiting.map((o) => o.id)).toEqual([order.id])
    expect((await report()).couriers).toEqual([])
    const confirmed = await owner(`/owner/orders/${order.id}/payment`, {
        action: "paid",
        method: "card_transfer",
    })
    expect(confirmed.status).toBe(200)
})

test("a debt: delivered now, paid later; the owner marks it", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    for (const status of ["accepted", "preparing", "ready", "picked_up"]) {
        await owner(`/owner/orders/${order.id}`, { status })
    }
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Мой магазин" }).click()
    const card = page
        .locator("li")
        .filter({ has: page.getByText(`Заказ #${order.number}`, { exact: true }) })
    await card.getByRole("button", { name: "Доставлен", exact: true }).click()
    await page
        .getByRole("dialog")
        .getByRole("button", { name: /Заплатит позже/ })
        .click()
    await page.getByRole("tab", { name: "Завершённые" }).click()
    await expect(card).toContainText("Не оплачено")

    await page.getByRole("tab", { name: "Деньги" }).click()
    const debts = block(page, "Не оплачено")
    await expect(debts).toContainText(`Заказ #${order.number}`)
    await debts.getByRole("button", { name: "Оплатил наличными" }).click()
    await expect(debts).toBeHidden()
})

test("a paid order cancelled: owed back until «Вернул»", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }], {
        paymentMethod: "card_transfer",
    })
    await owner(`/owner/orders/${order.id}/payment`, { action: "paid", method: "card_transfer" })
    await owner(`/owner/orders/${order.id}`, { status: "cancelled" })
    await openMoney(page)
    const refunds = block(page, "Вернуть клиентам")
    await expect(refunds).toContainText(/55\s000/)
    await refunds.getByRole("button", { name: "Вернул" }).click()
    await expect(refunds).toBeHidden()
    await expect(page.getByText("Всё оплачено, никто ничего не должен.")).toBeVisible()
})

test("the day adds up to the sum; the CSV report arrives in the owner's chat", async ({ page }) => {
    const today = await report()
    // Delivered today: 100 000 in cash, 55 000 by transfer, a 55 000 debt paid in cash.
    // The first transfer is paid but not delivered yet: money counts on delivery.
    expect(today.totals).toMatchObject({
        placed: 4,
        delivered: 3,
        cancelled: 1,
        paidCash: 155_000,
        paidCard: 55_000,
        awaiting: 0,
        debt: 0,
    })
    expect((today.totals["goods"] ?? 0) + (today.totals["delivery"] ?? 0)).toBe(210_000)

    const since = await lastSeq()
    await openMoney(page)
    await expect(page.getByText(/210\s000/).first()).toBeVisible()
    await page.getByRole("tab", { name: "Этот месяц" }).click()
    await page.getByRole("button", { name: "Отчёт для Excel" }).click()
    await expect(page.getByText("Отчёт отправлен в чат с ботом")).toBeVisible()
    const [csv] = await documentsTo(PEOPLE.foodOwner.id, since)
    expect(csv?.name).toMatch(/^osh-markaz-dev-.+\.csv$/)
    const bytes = Buffer.from(csv?.base64 ?? "", "base64")
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = bytes.toString("utf8").slice(1).trim().split("\r\n")
    // Header + the 5 orders of this file, the cancelled one too.
    expect(lines).toHaveLength(6)
    expect(lines[0]).toContain("Оплата")
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
