/**
 * The district network: an order of a shop whose own courier cannot take it goes to the free
 * network couriers of the district; the first «Беру» wins. The customer paid that shop's card
 * before cooking, so the courier carries no money.
 */
import { expect, test } from "@playwright/test"

import { courierBot } from "../stand/config.js"
import { runSql } from "../stand/seed.js"
import { FOOD, PEOPLE, apiAs, payAndAccept, placeOrder, resetStand } from "../support/stand.js"
import { courierChat, lastSeq, messagesTo, waitForMessage } from "../support/telegram.js"
import { appQueryOf, openApp, openSettings } from "../support/webapp.js"

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
        { landmark: "bozor yonida", location: { latitude: 38.99, longitude: 66.69 } },
    )
    const accepted = await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)
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
    expect(button?.text).toBe("🙋 Olaman")
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
    await waitForMessage(PEOPLE.foodOwner.id, "tuman tarmog'iga berildi", since)
    for (const person of [PEOPLE.networkCourier, PEOPLE.networkCourier2]) {
        const offer = await offerFor(person.id, order, since)
        expect(offer.text).toContain("Yaqinda yangi buyurtma")
        expect(offer.text).toContain("Osh Markaz")
        expect(offer.text).toContain("Oldindan to'langan, mijozdan pul olmang")
        expect(offer.text).not.toContain("Navoiy")
        expect(offer.text).not.toContain("bozor yonida")
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
    await waitForMessage(PEOPLE.networkCourier2.id, "boshqa kuryer oldi", since)
    const card = await waitForMessage(PEOPLE.networkCourier.id, "Navoiy 12", since)
    expect(card.text).toContain("Osh Markaz")
    expect(card.text).toContain("bozor yonida")
    await waitForMessage(PEOPLE.foodOwner.id, "tuman tarmog'i kuryeri olib boradi: Otabek", since)

    // Busy with one network order: Otabek is not offered the next one.
    const next = await lastSeq()
    const second = await placeAndAccept()
    await offerFor(PEOPLE.networkCourier2.id, second, next)
    const otabekNext = await messagesTo(PEOPLE.networkCourier.id, next)
    expect(otabekNext.filter((m) => m.text.includes(`#${second.number}`))).toEqual([])
})

test("Otabek delivers in the app with one «Доставил»; the money is already Osh Markaz's", async ({
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
    await page.getByRole("button", { name: "Oldim" }).click()
    await expect(page.getByText("Oldindan to'langan, pul olmang").first()).toBeVisible()
    await page.getByRole("button", { name: "Yetkazdim" }).click()
    await expect(page.getByRole("dialog")).toBeHidden()
    const shop = page
        .getByRole("listitem")
        .filter({ hasText: "tuman tarmog'i" })
        .filter({ hasText: "Osh Markaz" })
    await expect(shop).toBeVisible()
    await expect(shop).not.toContainText("Qo'lingizda")

    // «Yetkazdim» waits for the server; nothing on the screen above says it answered yet.
    const totals = async (): Promise<{ delivered: number; paid: number }> =>
        (
            (await (await owner("/owner/money", undefined, "GET")).json()) as {
                totals: { delivered: number; paid: number }
            }
        ).totals
    await expect.poll(totals).toMatchObject({ delivered: 1, paid: 100_000 })
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
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Kuryerlar")
    const network = page.getByRole("switch", {
        name: "Kuryerlarim band bo'lsa, tuman tarmog'iga berish",
    })
    await expect(network).toHaveAttribute("aria-checked", "true")
    await network.click()
    await expect(network).toHaveAttribute("aria-checked", "false")

    // Switched off: an accepted order stays with the shop.
    const since = await lastSeq()
    const order = await placeAndAccept()
    expect(order.waitingForNetwork).toBe(false)

    // By hand, from the order.
    await page.getByRole("tab", { name: "Buyurtmalar" }).click()
    const card = page.getByRole("listitem").filter({ hasText: `Buyurtma #${order.number}` })
    await card.getByRole("button", { name: "Kuryer tayinlash" }).click()
    await page
        .getByRole("dialog")
        .getByRole("button", { name: /Tuman tarmog'i kuryeri/ })
        .click()
    await expect(card).toContainText("Tuman tarmog'idan kuryer qidirilmoqda")
    await offerFor(PEOPLE.networkCourier2.id, order, since)

    // Jasur works again: the owner gives it to him, and the network's offers close.
    await ownCourierOff(false)
    await card.getByRole("button", { name: "Kuryer tayinlash" }).click()
    await page.getByRole("dialog").getByRole("button", { name: /Jasur/ }).click()
    await expect(card).toContainText("Kuryer: Jasur")
    await expect
        .poll(async () =>
            (await messagesTo(PEOPLE.networkCourier2.id, since))
                .filter((m) => m.method === "editMessageText")
                .some((m) => m.text.includes(`#${order.number}`)),
        )
        .toBe(true)

    await openSettings(page, "Kuryerlar")
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
    await nearby.getByRole("button", { name: "Olaman" }).click()
    await expect(page.getByText("Navoiy 12").first()).toBeVisible()

    const network = page.getByRole("switch", { name: "Tuman buyurtmalarini olaman" })
    await expect(network).toHaveAttribute("aria-checked", "true")
    await network.click()
    await expect(network).toHaveAttribute("aria-checked", "false")
    await expect(page.getByText("Yaqindagi buyurtmalar")).toBeHidden()
    const since = await lastSeq()
    const next = await placeAndAccept()
    await offerFor(PEOPLE.networkCourier.id, next, since)
    const sherzod = await messagesTo(PEOPLE.networkCourier2.id, since)
    expect(sherzod.filter((m) => m.text.includes(`#${next.number}`))).toEqual([])
})

test("nobody took it in 10 minutes: the shop and the admin hear it once", async ({ page }) => {
    const since = await lastSeq()
    const order = await placeAndAccept()
    runSql(
        `UPDATE orders SET network_requested_at = network_requested_at - 11 * 60000 WHERE id = '${order.id}'`,
    )
    // «Tumanlar» in «Platforma» also checks for late network orders (there is no cron).
    expect((await apiAs(PEOPLE.admin, "/admin/districts", { businessBot: true })).status).toBe(200)
    const late = await waitForMessage(PEOPLE.admin.id, `#${order.number} buyurtma 10 daqiqa`, since)
    await waitForMessage(PEOPLE.foodOwner.id, `#${order.number} buyurtma 10 daqiqadan beri`, since)

    const again = await lastSeq()
    await openApp(page, { user: PEOPLE.admin, businessBot: true, query: appQueryOf(late.buttons) })
    const district = page.getByRole("listitem").filter({ hasText: "Yakkabog'" })
    await expect(district).toContainText("Kutmoqda")
    await expect(district).toContainText("Do'konlar")
    const owners = await messagesTo(PEOPLE.foodOwner.id, again)
    expect(owners.filter((m) => m.text.includes("10 daqiqadan beri"))).toEqual([])
    await ownCourierOff(false)
})
