import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    hireCourier,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const COURIER = { id: 5005, first_name: "Jasur", language_code: "ru" }
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
const CARD = { number: "4111 1111 1111 1111", holder: "Rustam Karimov" }
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

interface Json {
    [key: string]: unknown
}
interface Order {
    id: string
    number: number
    total: number
    status: string
    payment: { method: string; status: string; cashCourierId?: string }
}

async function json<T = Json>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("money: payments, courier cash, report, files", () => {
    let client: TestClient
    let slug: string
    let courierId: string
    let productId: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })

    async function place(paymentMethod?: string): Promise<Response> {
        return as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 2 }], address: "Navoiy 12", paymentMethod },
        })
    }

    const setStatus = (id: string, status: string, paidWith?: string): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${id}`, { method: "PATCH", json: { status, paidWith } })

    /** Accepted, assigned to the courier, cooked, picked up: the courier is at the door. */
    async function atTheDoor(order: Order): Promise<void> {
        await setStatus(order.id, "accepted")
        await as(OWNER)(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { courierId },
        })
        await setStatus(order.id, "preparing")
        await setStatus(order.id, "ready")
        await courierApp(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
    }

    const courierApp = (path: string, init?: RequestInit & { json?: unknown }): Promise<Response> =>
        client.as(COURIER, { courierBot: true })(path, init)

    const money = async (): Promise<{
        totals: Json
        awaiting: Order[]
        debts: Order[]
        refunds: Order[]
        couriers: { courierId: string; onHand: number }[]
    }> => json(await as(OWNER)("/api/owner/money"))

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        const product = await as(OWNER)("/api/owner/products", {
            method: "POST",
            json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
        })
        productId = (await json<{ id: string }>(product)).id
        courierId = await hireCourier(client, { slug }, COURIER)
        await as(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
    })

    it("a transfer needs the shop's card; the card shows in the shop, not in lists", async () => {
        const refused = await place("card_transfer")
        expect(refused.status).toBe(422)
        expect(await json(refused)).toMatchObject({ error: { code: "CARD_TRANSFER_UNAVAILABLE" } })

        const typo = await as(OWNER)("/api/owner/shop", {
            method: "PATCH",
            json: { payoutCard: { number: "4111 1111 1111 1112", holder: "R" } },
        })
        expect(typo.status).toBe(400)
        await as(OWNER)("/api/owner/shop", { method: "PATCH", json: { payoutCard: CARD } })
        const shop = await json<{ payoutCard?: Json }>(await as(CUSTOMER)("/api/shop"))
        expect(shop.payoutCard).toEqual({ number: "4111111111111111", holder: "Rustam Karimov" })

        const order = await json<Order>(await place("card_transfer"))
        expect(order.payment).toMatchObject({ method: "card_transfer", status: "awaiting" })
        const card = client.telegram.sent.find(
            (m) => m.chatId === OWNER.id && m.html.includes("#1"),
        )
        expect(card?.html).toMatch(/o'tkazma · kutilmoqda|Перевод на карту · ждём/)
    })

    it("cash at the door: three buttons for the courier, cash on hand, handover", async () => {
        const order = await json<Order>(await place())
        await atTheDoor(order)
        const card = client.telegram.edited.filter((m) => m.chatId === COURIER.id).at(-1)
        const buttons = card?.options?.keyboard?.inline_keyboard.flat() ?? []
        expect(buttons.map((b) => b.callback_data)).toEqual([
            `a:${order.id}:delivered:cash`,
            `a:${order.id}:delivered:card_transfer`,
            `a:${order.id}:delivered:later`,
        ])
        expect(card?.html).toContain("Взять с клиента")

        // Without saying how the customer paid, "delivered" is refused.
        const blind = await courierApp(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "delivered" },
        })
        expect(blind.status).toBe(400)

        await client.courierBot({
            callback_query: { id: "cb-1", from: COURIER, data: `a:${order.id}:delivered:cash` },
        })
        const home = await json<{ shops: { onHand: number }[] }>(
            await courierApp("/api/courier/home"),
        )
        expect(home.shops[0]?.onHand).toBe(80_000)
        let report = await money()
        expect(report.totals).toMatchObject({ delivered: 1, paidCash: 80_000, goods: 70_000 })
        expect(report.couriers).toMatchObject([{ courierId, onHand: 80_000 }])

        const tooMuch = await as(OWNER)(`/api/owner/couriers/${courierId}/handovers`, {
            method: "POST",
            json: { amount: 90_000 },
        })
        expect(tooMuch.status).toBe(422)
        const handed = await as(OWNER)(`/api/owner/couriers/${courierId}/handovers`, {
            method: "POST",
            json: { amount: 80_000 },
        })
        expect(await json(handed)).toEqual({ data: [] })
        report = await money()
        expect(report.couriers).toEqual([])
    })

    it("a transfer at the door is confirmed by the owner; the customer hears it", async () => {
        const order = await json<Order>(await place())
        await atTheDoor(order)
        await courierApp(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "delivered", paidWith: "card_transfer" },
        })
        let report = await money()
        expect(report.awaiting.map((o) => o.id)).toEqual([order.id])
        expect(report.couriers).toEqual([])

        const confirmed = await as(OWNER)(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "paid", method: "card_transfer" },
        })
        expect(await json<Order>(confirmed)).toMatchObject({ payment: { status: "paid" } })
        expect(client.telegram.sent.at(-1)).toMatchObject({ chatId: CUSTOMER.id })
        expect(client.telegram.sent.at(-1)?.html).toContain("Оплата заказа #1 получена")
        report = await money()
        expect(report.totals).toMatchObject({ paidCard: 80_000, awaiting: 0 })
    })

    it("debts and refunds", async () => {
        const debt = await json<Order>(await place())
        await setStatus(debt.id, "accepted")
        await setStatus(debt.id, "preparing")
        await setStatus(debt.id, "ready")
        await setStatus(debt.id, "picked_up")
        await setStatus(debt.id, "delivered", "later")
        let report = await money()
        expect(report.debts.map((o) => o.id)).toEqual([debt.id])

        await as(OWNER)("/api/owner/shop", { method: "PATCH", json: { payoutCard: CARD } })
        const paid = await json<Order>(await place("card_transfer"))
        await as(OWNER)(`/api/owner/orders/${paid.id}/payment`, {
            method: "PATCH",
            json: { action: "paid", method: "card_transfer" },
        })
        await setStatus(paid.id, "cancelled")
        report = await money()
        expect(report.refunds.map((o) => o.id)).toEqual([paid.id])
        await as(OWNER)(`/api/owner/orders/${paid.id}/payment`, {
            method: "PATCH",
            json: { action: "refunded" },
        })
        // A second "refunded" is refused: it was already given back.
        const again = await as(OWNER)(`/api/owner/orders/${paid.id}/payment`, {
            method: "PATCH",
            json: { action: "refunded" },
        })
        expect(again.status).toBe(422)
        report = await money()
        expect(report.refunds).toEqual([])
    })

    it("the report as a CSV file and the QR poster arrive in the owner's chat", async () => {
        await place()
        const sent = await as(OWNER)("/api/owner/money/export?period=month", { method: "POST" })
        expect(await json(sent)).toEqual({ sent: 1 })
        const csv = client.telegram.documents.at(-1)
        expect(csv?.chatId).toBe(OWNER.id)
        expect(csv?.token).toBe(SHOP_BOT_TOKEN)
        expect(csv?.file.name).toMatch(/\.csv$/)
        // The UTF-8 BOM (EF BB BF) makes Excel read Cyrillic and Uzbek letters right.
        expect([...(csv?.file.bytes.slice(0, 3) ?? [])]).toEqual([0xef, 0xbb, 0xbf])
        const text = new TextDecoder().decode(csv?.file.bytes)
        const [header, row] = text.split("\r\n")
        expect(header?.split(";")).toHaveLength(16)
        expect(row).toContain(";80000;")

        const png = new Uint8Array([...PNG_HEADER, 0, 0, 0, 13])
        const poster = await as(OWNER)("/api/owner/shop/poster", {
            method: "PUT",
            headers: { "Content-Type": "image/png" },
            body: png,
        })
        expect(poster.status).toBe(404)
        const posted = await as(OWNER)("/api/owner/shop/poster", {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: png,
        })
        expect(posted.status).toBe(200)
        expect(client.telegram.documents.at(-1)?.file.contentType).toBe("image/png")
        const fake = await as(OWNER)("/api/owner/shop/poster", {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: new TextEncoder().encode("<html>"),
        })
        expect(fake.status).toBe(415)
    })

    it("only the owner sees the shop's money", async () => {
        expect((await as(CUSTOMER)("/api/owner/money")).status).toBe(403)
        expect((await as(COURIER)("/api/owner/money")).status).toBe(403)
        expect((await as(CUSTOMER)("/api/courier/home")).status).toBe(403)
        expect((await as(OWNER)("/api/owner/money?period=year")).status).toBe(400)
    })
})
