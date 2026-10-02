/**
 * The shop's courier: gets an order card in the shop bot, waits for "ready", picks up and
 * delivers from the chat or from "Мои доставки"; never sees other orders or kitchen steps.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, WATER, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, messagesTo, shopChat, waitForMessage } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { PlacedOrder } from "../support/stand.js"

const COURIER_ID = "dev-food-courier"

async function owner(orderId: string, json: object, path = "", shop = FOOD): Promise<Response> {
    return apiAs(PEOPLE.foodOwner, `/owner/orders/${orderId}${path}`, {
        shop,
        method: path ? "PUT" : "PATCH",
        json,
    })
}

async function assigned(): Promise<PlacedOrder> {
    const order = await placeOrder(
        PEOPLE.customer,
        FOOD,
        [{ productId: "dev-food-p1", quantity: 2 }],
        { landmark: "возле рынка", location: { latitude: 40.49, longitude: 68.78 } },
    )
    expect((await owner(order.id, { status: "accepted" })).status).toBe(200)
    expect((await owner(order.id, { courierId: COURIER_ID }, "/courier")).status).toBe(200)
    return order
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("the assigned courier gets the order card: address, phone, cash, map; no buttons yet", async () => {
    const since = await lastSeq()
    const order = await assigned()
    const card = await waitForMessage(PEOPLE.courier.id, `#${order.number}`, since)
    expect(card.token).toContain("100200300:") // the shop's own bot
    expect(card.text).toContain("Navoiy 12")
    expect(card.text).toContain("+998 90 123 45 67")
    expect(card.text).toMatch(/Взять с клиента: <b>100\s000/)
    expect(card.text).toContain("возле рынка")
    expect(card.text).toContain("yandex")
    expect(card.buttons.filter((b) => b.callback_data)).toHaveLength(0)
    expect(card.text).toContain("Сообщим, когда заказ будет готов")
    // The customer learns the courier's name, never the phone.
    expect((await owner(order.id, { status: "preparing" })).status).toBe(200)
    expect((await owner(order.id, { status: "ready" })).status).toBe(200)
    await waitForMessage(PEOPLE.courier.id, `Заказ #${order.number} готов`, since)
})

test("ready → «Забрал» in the chat → «Доставил» in the app; the customer is told", async ({
    page,
}) => {
    const orders = (await (
        await apiAs(PEOPLE.courier, "/courier/orders", { shop: FOOD })
    ).json()) as {
        data: { id: string; number: number; status: string }[]
    }
    const order = orders.data.find((o) => o.status === "ready")
    expect(order).toBeDefined()
    const edited = (await messagesTo(PEOPLE.courier.id))
        .filter((m) => m.method === "editMessageText")
        .at(-1)
    const picked = edited?.buttons.find((b) => b.callback_data?.endsWith(":picked_up"))
    expect(picked?.text).toBe("🚚 Забрал")

    const since = await lastSeq()
    await shopChat(FOOD).press(PEOPLE.courier, picked?.callback_data ?? "")
    const told = await waitForMessage(PEOPLE.customer.id, `#${order?.number ?? 0}`, since)
    expect(told.text).toContain("Jasur")
    expect(told.text).not.toContain("+998901112233")
    expect(told.text).not.toContain("+998 90 111 22 33")

    await openApp(page, { user: PEOPLE.courier, shop: FOOD, query: `?shop=${FOOD}&mode=courier` })
    await expect(page.getByRole("heading", { name: "Мои доставки" })).toBeVisible()
    await expect(page.getByText(/100\s000/).first()).toBeVisible()
    const before = await lastSeq()
    await page.getByRole("button", { name: "Доставил" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Наличными" }).click()
    await expect(page.getByText(/Доставлено сегодня · 1/)).toBeVisible()
    // The cash taken at the door is now on the courier's hands.
    await expect(page.getByText(/На руках: 100\s000/)).toBeVisible()
    await waitForMessage(PEOPLE.customer.id, "доставлен", before)
})

test("the customer sees «Везёт Jasur» while the order is on the way", async ({ page }) => {
    const order = await assigned()
    await owner(order.id, { status: "preparing" })
    await owner(order.id, { status: "ready" })
    await apiAs(PEOPLE.courier, `/courier/orders/${order.id}`, {
        shop: FOOD,
        method: "PATCH",
        json: { status: "picked_up" },
    })
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Мои заказы" }).click()
    await page.getByRole("button", { name: new RegExp(`Заказ #${order.number}`) }).click()
    await expect(page.getByText("Везёт Jasur")).toBeVisible()
    await expect(page.getByRole("heading", { name: "В пути" })).toBeVisible()
})

test("a courier moves only own orders and only the delivery part; never cancels", async () => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await owner(order.id, { status: "accepted" })
    const notMine = await apiAs(PEOPLE.courier, `/courier/orders/${order.id}`, {
        shop: FOOD,
        method: "PATCH",
        json: { status: "picked_up" },
    })
    expect(notMine.status).toBe(403)
    await owner(order.id, { courierId: COURIER_ID }, "/courier")
    const kitchen = await apiAs(PEOPLE.courier, `/courier/orders/${order.id}`, {
        shop: FOOD,
        method: "PATCH",
        json: { status: "preparing" },
    })
    expect(kitchen.status).toBe(400)
    const early = await apiAs(PEOPLE.courier, `/courier/orders/${order.id}`, {
        shop: FOOD,
        method: "PATCH",
        json: { status: "picked_up" },
    })
    expect([409, 422]).toContain(early.status)
    const cancel = await apiAs(PEOPLE.courier, `/courier/orders/${order.id}`, {
        shop: FOOD,
        method: "PATCH",
        json: { status: "cancelled" },
    })
    expect(cancel.status).toBe(400)
    expect((await apiAs(PEOPLE.courier, "/owner/orders", { shop: FOOD })).status).toBe(403)
})

test("reassigning tells the previous courier; the order leaves their list", async () => {
    // A second courier joins through an invite.
    const invite = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/couriers/invites", { shop: FOOD, method: "POST" })
    ).json()) as { link: string }
    await shopChat(FOOD).send(PEOPLE.newCourier, `/start ${invite.link.split("start=")[1] ?? ""}`)
    const couriers = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/couriers", { shop: FOOD })
    ).json()) as {
        id: string
        name: string
    }[]
    const bobur = couriers.find((c) => c.name === "Bobur")

    const order = await assigned()
    const since = await lastSeq()
    expect((await owner(order.id, { courierId: bobur?.id }, "/courier")).status).toBe(200)
    await waitForMessage(PEOPLE.courier.id, `#${order.number} передан другому`, since)
    await waitForMessage(PEOPLE.newCourier.id, `#${order.number}`, since)
    const left = (await (
        await apiAs(PEOPLE.courier, "/courier/orders", { shop: FOOD })
    ).json()) as {
        data: { id: string }[]
    }
    expect(left.data.map((o) => o.id)).not.toContain(order.id)
})

test("the courier's screen: empty state, and the shop bot's /start opens it", async ({ page }) => {
    const since = await lastSeq()
    await shopChat(WATER).send(PEOPLE.courier, "/start")
    const welcome = await waitForMessage(PEOPLE.courier.id, "Toza Suv", since)
    // A courier who is also a shopper gets both: the catalog and the deliveries.
    expect(welcome.buttons.map((b) => b.web_app?.url)).toEqual([
        `http://localhost:5173/?shop=${WATER}`,
        `http://localhost:5173/?shop=${WATER}&mode=courier`,
    ])

    await openApp(page, { user: PEOPLE.courier, shop: WATER, query: `?shop=${WATER}&mode=courier` })
    await expect(page.getByText("Пока заказов нет")).toBeVisible()
})

test("a customer who opens the courier link sees no deliveries", async ({ page }) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD, query: `?shop=${FOOD}&mode=courier` })
    await expect(page.getByText("Это действие вам недоступно.")).toBeVisible()
})
