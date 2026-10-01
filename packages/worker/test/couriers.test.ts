import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const COURIER = { id: 5005, first_name: "Jasur", language_code: "uz" }
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"

interface Json {
    id?: string
    [key: string]: unknown
}

async function json<T = Json>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("shop couriers, verticals and channels", () => {
    let client: TestClient
    let slug: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })

    async function botUpdate(body: object): Promise<Response> {
        const row = await env.DB.prepare("SELECT webhook_secret FROM businesses").first<{
            webhook_secret: string
        }>()
        return client.request(`/tg/${SHOP_BOT.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [SECRET_HEADER]: row?.webhook_secret ?? "",
            },
            body: JSON.stringify(body),
        })
    }

    async function hireCourier(): Promise<string> {
        const invite = await json<{ link: string }>(
            await as(OWNER)("/api/owner/couriers/invites", { method: "POST" }),
        )
        const code = invite.link.split("start=")[1]
        await botUpdate({
            message: { from: COURIER, chat: { id: COURIER.id }, text: `/start ${code}` },
        })
        const [courier] = await json<{ id: string }[]>(await as(OWNER)("/api/owner/couriers"))
        return courier?.id ?? ""
    }

    async function addProduct(body: object): Promise<string> {
        const response = await as(OWNER)("/api/owner/products", { method: "POST", json: body })
        expect(response.status).toBe(201)
        return (await json<{ id: string }>(response)).id
    }

    async function placeOrder(items: object[], extra: object = {}): Promise<Json> {
        await as(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const response = await as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items, address: "Navoiy 12", ...extra },
        })
        expect(response.status).toBe(201)
        return json(response)
    }

    const setStatus = (orderId: unknown, status: string): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${String(orderId)}`, { method: "PATCH", json: { status } })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
    })

    it("invite link → courier joins through the shop bot, the owner is told", async () => {
        const response = await as(OWNER)("/api/owner/couriers/invites", { method: "POST" })
        expect(response.status).toBe(201)
        const { link } = await json<{ link: string }>(response)
        expect(link).toMatch(/^https:\/\/t\.me\/osh_markaz_bot\?start=c_[A-Za-z0-9_-]{16}$/)

        const code = link.split("start=")[1]
        await botUpdate({
            message: { from: COURIER, chat: { id: COURIER.id }, text: `/start ${code}` },
        })
        const [welcome, toOwner] = client.telegram.sent.slice(-2)
        expect(welcome?.chatId).toBe(COURIER.id)
        expect(welcome?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
            "mode=courier",
        )
        expect(toOwner?.chatId).toBe(OWNER.id)
        expect(toOwner?.html).toContain("Jasur")

        const shop = await json(await as(COURIER)("/api/shop"))
        expect(shop).toMatchObject({ viewerRole: "courier" })

        // The same link does not work twice.
        await botUpdate({
            message: { from: STRANGER, chat: { id: STRANGER.id }, text: `/start ${code}` },
        })
        expect(client.telegram.sent.at(-1)?.chatId).toBe(STRANGER.id)
        expect(await json<unknown[]>(await as(OWNER)("/api/owner/couriers"))).toHaveLength(1)
    })

    it("assign → courier card → ready ping → picked up → delivered, customer sees the name", async () => {
        const courierId = await hireCourier()
        const osh = await addProduct({
            name: "Osh",
            price: 35_000,
            unit: "portion",
            category: "meals",
        })
        const order = await placeOrder([{ productId: osh, quantity: 2 }])
        expect(order).toMatchObject({ channel: "shop_bot", commission: 0, commissionBps: 0 })

        await setStatus(order.id, "accepted")
        const assigned = await as(OWNER)(`/api/owner/orders/${String(order.id)}/courier`, {
            method: "PUT",
            json: { courierId },
        })
        expect(await json(assigned)).toMatchObject({ courierName: "Jasur" })
        const card = client.telegram.sent.find(
            (m) => m.chatId === COURIER.id && m.html.includes("#1"),
        )
        expect(card?.html).toContain("Navoiy 12")
        expect(card?.html).toContain("80 000")
        expect(card?.options?.keyboard?.inline_keyboard).toHaveLength(0)

        await setStatus(order.id, "preparing")
        await setStatus(order.id, "ready")
        const edited = client.telegram.edited.filter((m) => m.chatId === COURIER.id).at(-1)
        expect(edited?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data).toBe(
            `a:${String(order.id)}:picked_up`,
        )
        expect(
            client.telegram.sent.some((m) => m.chatId === COURIER.id && m.html.includes("tayyor")),
        ).toBe(true)

        const picked = await as(COURIER)(`/api/courier/orders/${String(order.id)}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        expect(picked.status).toBe(200)
        const toCustomer = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toCustomer?.html).toContain("Jasur")

        await botUpdate({
            callback_query: { id: "cb-1", from: COURIER, data: `a:${String(order.id)}:delivered` },
        })
        const mine = await json<{ data: { status: string }[] }>(
            await as(COURIER)("/api/courier/orders"),
        )
        expect(mine.data[0]?.status).toBe("delivered")
    })

    it("a courier moves only their own orders and only the delivery part", async () => {
        await hireCourier()
        const osh = await addProduct({
            name: "Osh",
            price: 35_000,
            unit: "portion",
            category: "meals",
        })
        const order = await placeOrder([{ productId: osh, quantity: 2 }])
        await setStatus(order.id, "accepted")

        const notMine = await as(COURIER)(`/api/courier/orders/${String(order.id)}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        expect(notMine.status).toBe(403)
        const kitchenStep = await as(COURIER)(`/api/courier/orders/${String(order.id)}`, {
            method: "PATCH",
            json: { status: "preparing" },
        })
        expect(kitchenStep.status).toBe(400)
        expect((await as(CUSTOMER)("/api/courier/orders")).status).toBe(403)
        expect((await as(COURIER)("/api/owner/orders")).status).toBe(403)
    })

    it("reassigning tells the previous courier, even before their card was stored", async () => {
        const first = await hireCourier()
        const second = { id: 5006, first_name: "Bobur", language_code: "ru" }
        const invite = await json<{ link: string }>(
            await as(OWNER)("/api/owner/couriers/invites", { method: "POST" }),
        )
        await botUpdate({
            message: {
                from: second,
                chat: { id: second.id },
                text: `/start ${invite.link.split("start=")[1] ?? ""}`,
            },
        })
        const couriers = await json<{ id: string; name: string }[]>(
            await as(OWNER)("/api/owner/couriers"),
        )
        const bobur = couriers.find((c) => c.name === "Bobur")?.id
        const osh = await addProduct({
            name: "Osh",
            price: 35_000,
            unit: "portion",
            category: "meals",
        })
        const order = await placeOrder([{ productId: osh, quantity: 2 }])
        await setStatus(order.id, "accepted")
        await as(OWNER)(`/api/owner/orders/${String(order.id)}/courier`, {
            method: "PUT",
            json: { courierId: first },
        })
        // As if the first card's id had not been saved yet.
        await env.DB.prepare("UPDATE orders SET courier_message_id = NULL").run()
        await as(OWNER)(`/api/owner/orders/${String(order.id)}/courier`, {
            method: "PUT",
            json: { courierId: bobur },
        })
        expect(
            client.telegram.sent.some((m) => m.chatId === COURIER.id && m.html.includes("#1")),
        ).toBe(true)
        const toBobur = client.telegram.sent.find(
            (m) => m.chatId === second.id && m.html.includes("#1"),
        )
        // Bobur's Telegram is in Russian: so is his order card.
        expect(toBobur?.html).toContain("Доставка")
        const removed = client.telegram.sent.filter((m) => m.chatId === COURIER.id).at(-1)
        expect(removed?.html).toContain("#1")
        expect(removed?.html).not.toContain("Navoiy")
    })

    it("the owner removes a courier", async () => {
        const courierId = await hireCourier()
        const removed = await as(OWNER)(`/api/owner/couriers/${courierId}`, { method: "DELETE" })
        expect(removed.status).toBe(204)
        expect(await json<unknown[]>(await as(OWNER)("/api/owner/couriers"))).toHaveLength(0)
        expect((await as(COURIER)("/api/courier/orders")).status).toBe(403)
    })

    it("grocery: weight items in grams, stop-list for today", async () => {
        const tomato = await addProduct({
            name: "Pomidor",
            price: 12_000,
            unit: "kg",
            category: "produce",
            step: 500,
        })
        const order = await placeOrder([{ productId: tomato, quantity: 1500 }])
        expect(order).toMatchObject({ subtotal: 18_000 })
        const bad = await as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId: tomato, quantity: 700 }], address: "Navoiy 12" },
        })
        expect(bad.status).toBe(400)

        await as(OWNER)(`/api/owner/products/${tomato}`, {
            method: "PATCH",
            json: { stopForToday: true },
        })
        const catalog = await json<{ data: unknown[] }>(await as(CUSTOMER)("/api/shop/products"))
        expect(catalog.data).toHaveLength(0)
        const owner = await json<{ data: { unavailableUntil?: string }[] }>(
            await as(OWNER)("/api/owner/products"),
        )
        expect(owner.data[0]?.unavailableUntil).toBeDefined()
    })

    it("water: returned bottles lower the deposit; the owner card shows them", async () => {
        await as(OWNER)("/api/owner/shop", {
            method: "PATCH",
            json: { features: ["reorder", "bottleDeposit"], bottleDeposit: 30_000 },
        })
        const water = await addProduct({
            name: "Suv 19 l",
            price: 15_000,
            unit: "bottle_19l",
            category: "water",
            returnable: true,
        })
        const order = await placeOrder([{ productId: water, quantity: 2 }], { bottlesReturned: 1 })
        expect(order).toMatchObject({ depositTotal: 30_000, bottlesReturned: 1, total: 70_000 })
        const card = client.telegram.sent.find(
            (m) => m.chatId === OWNER.id && m.html.includes("#1"),
        )
        expect(card?.html).toContain("30 000")
    })

    it("bot words follow the business type", async () => {
        const osh = await addProduct({
            name: "Osh",
            price: 35_000,
            unit: "portion",
            category: "meals",
        })
        const order = await placeOrder([{ productId: osh, quantity: 2 }])
        await setStatus(order.id, "accepted")
        await setStatus(order.id, "preparing")
        expect(client.telegram.sent.at(-1)?.html).toContain("👨‍🍳")

        await env.DB.prepare("UPDATE businesses SET type = 'grocery'").run()
        const second = await placeOrder([{ productId: osh, quantity: 2 }])
        await setStatus(second.id, "accepted")
        await setStatus(second.id, "preparing")
        expect(client.telegram.sent.at(-1)?.html).toContain("Собираем")
    })
})
