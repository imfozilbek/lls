/**
 * The district network: an order of a shop whose own courier cannot take it goes to the free
 * network couriers of the district; the first «Беру» wins; the cash goes back to that shop.
 */
import { expect, test } from "@playwright/test"

import { courierBot } from "../stand/config.js"
import { runSql } from "../stand/seed.js"
import { FOOD, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { courierChat, lastSeq, llsChat, messagesTo, waitForMessage } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { PlacedOrder } from "../support/stand.js"

const OWN_COURIER = "dev-food-courier"

interface OrderBody {
    id: string
    number: number
    total: number
    waitingForNetwork: boolean
    viaNetwork: boolean
}

async function owner(path: string, json?: object, method = "PATCH"): Promise<Response> {
    return apiAs(PEOPLE.foodOwner, path, { shop: FOOD, method, json })
}

/** Jasur, the shop's own courier, does not work today: nobody of the shop can take it. */
async function ownCourierOff(off = true): Promise<void> {
    const response = await owner(`/owner/couriers/${OWN_COURIER}`, { offToday: off })
    expect(response.status).toBe(200)
}

async function placeAndAccept(): Promise<OrderBody> {
    const order: PlacedOrder = await placeOrder(
        PEOPLE.customer,
        FOOD,
        [{ productId: "dev-food-p1", quantity: 2 }],
        { landmark: "возле рынка", location: { latitude: 40.5, longitude: 68.79 } },
    )
    const accepted = await owner(`/owner/orders/${order.id}`, { status: "accepted" })
    expect(accepted.status).toBe(200)
    return (await accepted.json()) as OrderBody
}

/** The «Беру» offer a courier got for this order, with its message id for the press. */
async function offerFor(
    chatId: number,
    order: OrderBody,
    since: number,
): Promise<{ data: string; messageId: number; text: string }> {
    const message = await waitForMessage(chatId, `#${order.number}`, since)
    const button = message.buttons.find((b) => b.callback_data === `n:${order.id}`)
    expect(button?.text).toBe("🙋 Беру")
    expect(message.token).toBe(courierBot().token)
    return { data: button?.callback_data ?? "", messageId: message.seq, text: message.text }
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("no free courier of its own: the order goes to the network, without the customer", async () => {
    await ownCourierOff()
    const since = await lastSeq()
    const order = await placeAndAccept()
    expect(order.waitingForNetwork).toBe(true)
    await waitForMessage(PEOPLE.foodOwner.id, "отдан сети района", since)
    for (const person of [PEOPLE.networkCourier, PEOPLE.networkCourier2]) {
        const offer = await offerFor(person.id, order, since)
        expect(offer.text).toContain("Новый заказ рядом")
        expect(offer.text).toContain("Osh Markaz")
        expect(offer.text).toMatch(/Взять с клиента: <b>100\s000/)
        expect(offer.text).not.toContain("Navoiy")
        expect(offer.text).not.toContain("возле рынка")
        expect(offer.text).not.toContain("Aziz")
    }
    // Jasur is not in the network: he hears nothing about it.
    const jasur = await messagesTo(PEOPLE.courier.id, since)
    expect(jasur.filter((m) => m.text.includes(`#${order.number}`))).toEqual([])
})

test("the first «Беру» wins; the second hears it is taken; the owner learns who brings it", async () => {
    const since = await lastSeq()
    const order = await placeAndAccept()
    const otabek = await offerFor(PEOPLE.networkCourier.id, order, since)
    await offerFor(PEOPLE.networkCourier2.id, order, since)

    await courierChat().press(PEOPLE.networkCourier, otabek.data, 1)
    await courierChat().press(PEOPLE.networkCourier2, `n:${order.id}`, 1)
    await waitForMessage(PEOPLE.networkCourier2.id, "уже взял другой доставщик", since)
    const card = await waitForMessage(PEOPLE.networkCourier.id, "Navoiy 12", since)
    expect(card.text).toContain("Osh Markaz")
    expect(card.text).toContain("возле рынка")
    await waitForMessage(PEOPLE.foodOwner.id, "доставщик сети района: Otabek", since)

    // Busy with one network order: Otabek is not offered the next one.
    const next = await lastSeq()
    const second = await placeAndAccept()
    await offerFor(PEOPLE.networkCourier2.id, second, next)
    const otabekNext = await messagesTo(PEOPLE.networkCourier.id, next)
    expect(otabekNext.filter((m) => m.text.includes(`#${second.number}`))).toEqual([])
})

test("Otabek delivers in the app; the cash is Osh Markaz's, and its owner takes it", async ({
    page,
}) => {
    const home = (await (
        await apiAs(PEOPLE.networkCourier, "/courier/home", { courierBot: true })
    ).json()) as { orders: { id: string; status: string; shopName: string }[] }
    const taken = home.orders.find((o) => o.shopName === "Osh Markaz")
    expect(taken).toBeDefined()
    for (const status of ["preparing", "ready"]) {
        await owner(`/owner/orders/${taken?.id ?? ""}`, { status })
    }
    await openApp(page, { user: PEOPLE.networkCourier, courierBot: true })
    await expect(page.getByText("Osh Markaz").first()).toBeVisible()
    await page.getByRole("button", { name: "Забрал" }).click()
    await page.getByRole("button", { name: "Доставил" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Наличными" }).click()
    const shop = page
        .getByRole("listitem")
        .filter({ hasText: "сеть района" })
        .filter({ hasText: "Osh Markaz" })
    await expect(shop).toContainText(/На руках: 100\s000/)

    const report = (await (await owner("/owner/money", undefined, "GET")).json()) as {
        couriers: { courierId: string; name: string; onHand: number }[]
    }
    const cash = report.couriers.find((c) => c.name === "Otabek")
    expect(cash?.onHand).toBe(100_000)
    const handed = await owner(
        `/owner/couriers/${cash?.courierId ?? ""}/handovers`,
        { amount: 100_000 },
        "POST",
    )
    expect(handed.status).toBe(200)
    // Not the shop's courier: its list stays its own.
    const list = (await (await owner("/owner/couriers", undefined, "GET")).json()) as {
        name: string
    }[]
    expect(list.map((c) => c.name)).toEqual(["Jasur"])
})

test("the owner: the network switch, «Доставщик сети района», and who brings it", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Мой магазин" }).click()
    await page.getByRole("tab", { name: "Настройки" }).click()
    const network = page.getByRole("switch", { name: "Если мои заняты — отдавать сети района" })
    await expect(network).toHaveAttribute("aria-checked", "true")
    await network.click()
    await expect(network).toHaveAttribute("aria-checked", "false")

    // Switched off: an accepted order stays with the shop.
    const since = await lastSeq()
    const order = await placeAndAccept()
    expect(order.waitingForNetwork).toBe(false)

    // By hand, from the order.
    await page.getByRole("tab", { name: "Заказы" }).click()
    const card = page.getByRole("listitem").filter({ hasText: `Заказ #${order.number}` })
    await card.getByRole("button", { name: "Назначить доставщика" }).click()
    await page
        .getByRole("dialog")
        .getByRole("button", { name: /Доставщик сети района/ })
        .click()
    await expect(card).toContainText("Ищем доставщика сети района")
    await offerFor(PEOPLE.networkCourier2.id, order, since)

    // Jasur works again: the owner gives it to him, and the network's offers close.
    await ownCourierOff(false)
    await card.getByRole("button", { name: "Назначить доставщика" }).click()
    await page.getByRole("dialog").getByRole("button", { name: /Jasur/ }).click()
    await expect(card).toContainText("Доставщик: Jasur")
    await expect
        .poll(async () =>
            (await messagesTo(PEOPLE.networkCourier2.id, since))
                .filter((m) => m.method === "editMessageText")
                .some((m) => m.text.includes(`#${order.number}`)),
        )
        .toBe(true)

    await page.getByRole("tab", { name: "Настройки" }).click()
    await network.click()
    await expect(network).toHaveAttribute("aria-checked", "true")
})

test("the courier's app: «Заказы рядом» with «Беру», and leaving the network", async ({ page }) => {
    await ownCourierOff()
    const order = await placeAndAccept()
    await openApp(page, { user: PEOPLE.networkCourier2, courierBot: true })
    const nearby = page.getByRole("listitem").filter({ hasText: `#${order.number}` })
    await expect(nearby).toContainText("Osh Markaz")
    await expect(nearby).not.toContainText("Navoiy")
    await nearby.getByRole("button", { name: "Беру" }).click()
    await expect(page.getByText("Navoiy 12").first()).toBeVisible()

    const network = page.getByRole("switch", { name: "Беру заказы района" })
    await expect(network).toHaveAttribute("aria-checked", "true")
    await network.click()
    await expect(network).toHaveAttribute("aria-checked", "false")
    await expect(page.getByText("Заказы рядом")).toBeHidden()
    const since = await lastSeq()
    const next = await placeAndAccept()
    await offerFor(PEOPLE.networkCourier.id, next, since)
    const sherzod = await messagesTo(PEOPLE.networkCourier2.id, since)
    expect(sherzod.filter((m) => m.text.includes(`#${next.number}`))).toEqual([])
})

test("nobody took it in 10 minutes: the shop and the admin hear it once", async () => {
    const since = await lastSeq()
    const order = await placeAndAccept()
    runSql(
        `UPDATE orders SET network_requested_at = network_requested_at - 11 * 60000 WHERE id = '${order.id}'`,
    )
    await llsChat().send(PEOPLE.admin, "/network")
    await waitForMessage(PEOPLE.admin.id, "Сеть района за 7 дней", since)
    await waitForMessage(PEOPLE.admin.id, `заказ #${order.number} 10 мин`, since)
    await waitForMessage(PEOPLE.foodOwner.id, `Заказ #${order.number} уже 10 мин`, since)
    const again = await lastSeq()
    await llsChat().send(PEOPLE.admin, "/network")
    await waitForMessage(PEOPLE.admin.id, "Сеть района за 7 дней", again)
    const owners = await messagesTo(PEOPLE.foodOwner.id, again)
    expect(owners.filter((m) => m.text.includes("уже 10 мин"))).toEqual([])
    await ownCourierOff(false)
})
