/**
 * The shop owner, orders: who sees "Мой магазин", orders from the app and the bot chat, cancel,
 * and the day's money from those orders.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, WATER, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, messagesTo, shopChat, waitForMessage } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { OpenedApp } from "../support/webapp.js"
import type { Page } from "@playwright/test"

async function openOwner(page: Page, options: { native?: boolean } = {}): Promise<OpenedApp> {
    const app = await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, ...options })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    return app
}

const card = (page: Page, number: number): ReturnType<Page["locator"]> =>
    page.locator("li").filter({ has: page.getByText(`Buyurtma #${number}`, { exact: true }) })

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("only the owner sees «Мой магазин»; an owner in another shop is a customer there", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Mening do'konim" })).toBeHidden()
    expect((await apiAs(PEOPLE.customer, "/owner/orders", { shop: FOOD })).status).toBe(403)

    await openApp(page, { user: PEOPLE.foodOwner, shop: WATER })
    await expect(page.getByRole("heading", { name: "Toza Suv", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Mening do'konim" })).toBeHidden()
})

test("empty orders, then a new order: card, every step from the app, customer told", async ({
    page,
}) => {
    await openOwner(page)
    await expect(page.getByText("Faol buyurtma yo'q")).toBeVisible()

    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await page.getByRole("tab", { name: "Yakunlangan" }).click()
    await page.getByRole("tab", { name: "Faol" }).click()
    const one = card(page, order.number)
    await expect(one).toContainText("To'y oshi")
    await expect(one).toContainText("Aziz Karimov")

    await expect(one).toContainText("O'tkazma kutilmoqda")
    const steps: [string, string][] = [
        ["Pul keldi, qabul qilish", "To'lov keldi"],
        ["Tayyorlashni boshlash", "tayyorlanmoqda"],
        ["Tayyor bo'ldi", "tayyor"],
        ["Jo'natish", "yo'lda"],
        ["Yetkazildi", "yetkazildi"],
    ]
    for (const [button, told] of steps) {
        const since = await lastSeq()
        await one.getByRole("button", { name: button, exact: true }).click()
        if (button.startsWith("Pul keldi")) {
            // The money is never one tap: the sheet asks with the sum.
            await page.getByRole("dialog").getByRole("button", { name: /^Ha, / }).click()
        }
        // Paid before cooking: «Доставлен» asks nothing more.
        await expect(page.getByRole("dialog")).toBeHidden()
        await waitForMessage(PEOPLE.customer.id, told, since)
    }
    await expect(one).toContainText("To'langan")
    await expect(one.getByRole("button", { name: "Bekor qilish" })).toBeHidden()
    await page.getByRole("tab", { name: "Yakunlangan" }).click()
    await expect(card(page, order.number)).toBeVisible()
})

test("cancel with a reason: the customer sees the reason", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await openOwner(page)
    const since = await lastSeq()
    await card(page, order.number).getByRole("button", { name: "Bekor qilish" }).click()
    await page.getByLabel("Sabab (ixtiyoriy)").fill("Palov tugadi")
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Bekor qilish", exact: true })
        .click()
    await expect(card(page, order.number)).toContainText("Bekor qilindi")
    await waitForMessage(PEOPLE.customer.id, "bekor qilindi", since)

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Buyurtmalarim" }).click()
    await page.getByRole("button", { name: new RegExp(`Buyurtma #${order.number}`) }).click()
    await expect(page.getByText("Palov tugadi")).toBeVisible()
})

test("bot chat buttons: «Деньги пришли, принять»; old buttons and strangers are refused", async () => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    const newCard = await waitForMessage(PEOPLE.foodOwner.id, `#${order.number}`, since)
    // A new order waits for the transfer: the step is «Деньги пришли, принять».
    expect(newCard.text).toContain("Kartaga o'tkazma kutilmoqda")
    const accept = newCard.buttons.find((b) => b.callback_data === `p:${order.id}`)
    expect(accept?.text).toBe("💳 Pul keldi, qabul qilish")

    // A stranger who got the button data cannot press it.
    await shopChat(FOOD).press(PEOPLE.stranger, accept?.callback_data ?? "")
    const order1 = await apiAs(PEOPLE.customer, `/orders/${order.id}`, { shop: FOOD })
    expect(((await order1.json()) as { status: string }).status).toBe("pending")

    await shopChat(FOOD).press(PEOPLE.foodOwner, accept?.callback_data ?? "")
    // «Pul keldi» asks first; «Ha» confirms.
    const question = await waitForMessage(PEOPLE.foodOwner.id, "keldimi?", since)
    const yes = question.buttons.find((b) => b.callback_data === `pc:${order.id}`)
    await shopChat(FOOD).press(PEOPLE.foodOwner, yes?.callback_data ?? "")
    // The card is edited in place with the next step.
    await expect
        .poll(async () =>
            (await messagesTo(PEOPLE.foodOwner.id, since))
                .filter((m) => m.method === "editMessageText")
                .at(-1)
                ?.buttons.map((b) => b.text),
        )
        .toContain("👨‍🍳 Tayyorlashni boshlash")
    // The old button again: the money is confirmed already, nothing changes.
    await shopChat(FOOD).press(PEOPLE.foodOwner, yes?.callback_data ?? "")
    const after = await apiAs(PEOPLE.customer, `/orders/${order.id}`, { shop: FOOD })
    expect(((await after.json()) as { status: string }).status).toBe("accepted")

    // Cancel from the chat.
    const cancel = newCard.buttons.find((b) => b.callback_data?.startsWith("x:"))
    const before = await lastSeq()
    await shopChat(FOOD).press(PEOPLE.foodOwner, cancel?.callback_data ?? "")
    await waitForMessage(PEOPLE.customer.id, "bekor qilindi", before)
})

test("«Деньги» count today's orders and revenue", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Pul" }).click()
    await expect(page.getByRole("tab", { name: "Bugun" })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByText("Tushum").first()).toBeVisible()
    // One delivered order for 55 000, paid by transfer before cooking, earlier in this file.
    await expect(page.getByText(/55\s000/).first()).toBeVisible()
})
