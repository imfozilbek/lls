import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    TEST_CARD as CARD,
    createActiveShop,
    hireCourier,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const COURIER = { id: 5005, first_name: "Jasur", language_code: "ru" }
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

interface Json {
    [key: string]: unknown
}
interface Order {
    id: string
    number: number
    total: number
    status: string
    payment: { method: string; status: string; card?: { number: string; holder: string } }
}

// A second card of the shop: a valid Luhn number, not a real card. secret-scan: fake
const SECOND_CARD = { number: "5614 6812 3456 7893", holder: "Malika Karimova" }

async function json<T = Json>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("money: transfer before the shop starts, report, files", () => {
    let client: TestClient
    let slug: string
    let courierId: string
    let productId: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })

    async function place(): Promise<Response> {
        return as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 2 }], address: "Navoiy 12" },
        })
    }

    const setStatus = (id: string, status: string): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${id}`, { method: "PATCH", json: { status } })

    const payment = (id: string, action: "paid" | "refunded"): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${id}/payment`, { method: "PATCH", json: { action } })

    const transferSent = (id: string, user: object = CUSTOMER): Promise<Response> =>
        as(user)(`/api/orders/${id}/transfer-sent`, { method: "POST" })

    const courierApp = (path: string, init?: RequestInit & { json?: unknown }): Promise<Response> =>
        client.as(COURIER, { courierBot: true })(path, init)

    const money = async (): Promise<{
        totals: Json
        awaiting: Order[]
        refunds: Order[]
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

    interface Cards {
        paymentCardId?: string
        cards: { id: string; number: string; holder: string }[]
    }

    const cards = (path = "", init?: RequestInit & { json?: unknown }): Promise<Response> =>
        as(OWNER)(`/api/owner/shop/cards${path}`, init)

    it("no payment card, no orders; the card shows in the shop", async () => {
        const shop = await json<{ payoutCard?: Json; hasPayoutCard: boolean }>(
            await as(CUSTOMER)("/api/shop"),
        )
        expect(shop.payoutCard).toEqual({ number: "4111111111111111", holder: "Rustam Karimov" })
        expect(shop.hasPayoutCard).toBe(true)

        // A shop that never added a card (as before cards were required).
        await env.DB.prepare(
            `UPDATE businesses SET payout_card_number = NULL, payout_card_holder = NULL,
                payment_card_id = NULL`,
        ).run()
        const closed = await json<{ hasPayoutCard: boolean }>(await as(CUSTOMER)("/api/shop"))
        expect(closed.hasPayoutCard).toBe(false)
        const refused = await place()
        expect(refused.status).toBe(422)
        expect(await json(refused)).toMatchObject({ error: { code: "NO_PAYOUT_CARD" } })
    })

    it("many cards: add, choose the payment card, remove; orders keep their card", async () => {
        let list = await json<Cards>(await cards())
        expect(list.cards).toHaveLength(1)
        expect(list.paymentCardId).toBe(list.cards[0]?.id)
        const first = list.cards[0]?.id ?? ""

        const typo = await cards("", {
            method: "POST",
            json: { number: "4111 1111 1111 1112", holder: "R" },
        })
        expect(typo.status).toBe(400)
        const added = await cards("", { method: "POST", json: SECOND_CARD })
        expect(added.status).toBe(201)
        list = await json<Cards>(added)
        const second = list.cards[1]?.id ?? ""
        expect(list.paymentCardId).toBe(first)
        const twice = await cards("", { method: "POST", json: SECOND_CARD })
        expect(await json(twice)).toMatchObject({ error: { code: "CARD_EXISTS" } })

        const before = await json<Order>(await place())
        expect(before.payment.card).toEqual({ number: "4111111111111111", holder: CARD.holder })

        list = await json<Cards>(await cards(`/${second}/payment`, { method: "PUT" }))
        expect(list.paymentCardId).toBe(second)
        const shop = await json<{ payoutCard?: Json }>(await as(CUSTOMER)("/api/shop"))
        expect(shop.payoutCard).toEqual({ number: "5614681234567893", holder: "Malika Karimova" })
        const after = await json<Order>(await place())
        const toPay = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toPay?.html).toContain("5614 6812 3456 7893")
        expect(after.payment.card?.number).toBe("5614681234567893")
        const old = await json<Order>(await as(CUSTOMER)(`/api/orders/${before.id}`))
        expect(old.payment.card?.number).toBe("4111111111111111")

        const inUse = await cards(`/${second}`, { method: "DELETE" })
        expect(await json(inUse)).toMatchObject({ error: { code: "PAYMENT_CARD_IN_USE" } })
        expect((await cards(`/${first}`, { method: "DELETE" })).status).toBe(204)
        list = await json<Cards>(await cards())
        expect(list.cards.map((c) => c.id)).toEqual([second])
        // Only the owner sees and changes the cards.
        expect((await as(CUSTOMER)("/api/owner/shop/cards")).status).toBe(403)
    })

    it("«Я перевёл» pings the owner once; «Деньги пришли — принять» starts the shop", async () => {
        const order = await json<Order>(await place())
        expect(order.payment).toMatchObject({ method: "card_transfer", status: "unpaid" })
        // The customer has the card and the sum in the chat right away.
        const toPay = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toPay?.html).toContain("4111 1111 1111 1111")
        expect(toPay?.html).toContain("80 000")

        // Only the customer of the order says it is sent.
        expect((await transferSent(order.id, OWNER)).status).toBe(403)
        const sent = await transferSent(order.id)
        expect(await json<Order>(sent)).toMatchObject({ payment: { status: "awaiting" } })
        const ping = client.telegram.sent.at(-1)
        expect(ping).toMatchObject({ chatId: OWNER.id, token: SHOP_BOT_TOKEN })
        expect(ping?.html).toContain("80 000")
        const before = client.telegram.sent.length
        await transferSent(order.id)
        expect(client.telegram.sent.length).toBe(before)
        expect((await money()).awaiting.map((o) => o.id)).toEqual([order.id])

        // Not by hand: the shop starts only after the money.
        expect((await setStatus(order.id, "accepted")).status).toBe(422)
        const accepted = await json<Order>(await payment(order.id, "paid"))
        expect(accepted).toMatchObject({ status: "accepted", payment: { status: "paid" } })
        expect(client.telegram.sent.at(-1)).toMatchObject({ chatId: CUSTOMER.id })
        expect(client.telegram.sent.at(-1)?.html).toContain("Оплата получена")
        expect((await money()).awaiting).toEqual([])
        // Pressed again: nothing left to confirm.
        expect((await payment(order.id, "paid")).status).toBe(422)
    })

    it("one «Доставил» for the courier, nothing to collect; the report adds up", async () => {
        const order = await json<Order>(await place())
        await payment(order.id, "paid")
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
        const card = client.telegram.edited.filter((m) => m.chatId === COURIER.id).at(-1)
        const buttons = card?.options?.keyboard?.inline_keyboard.flat() ?? []
        expect(buttons.map((b) => b.callback_data)).toEqual([`a:${order.id}:delivered`])
        expect(card?.html).toContain("денег с клиента не брать")

        await client.courierBot({
            callback_query: { id: "cb-1", from: COURIER, data: `a:${order.id}:delivered` },
        })
        const home = await json<{ shops: Json[] }>(await courierApp("/api/courier/home"))
        expect(home.shops[0]).not.toHaveProperty("onHand")
        const report = await money()
        expect(report.totals).toEqual({
            placed: 1,
            delivered: 1,
            cancelled: 0,
            goods: 70_000,
            delivery: 10_000,
            deposits: 0,
            paid: 80_000,
            commission: 0,
        })
        // The cash routes are gone.
        const handover = await as(OWNER)(`/api/owner/couriers/${courierId}/handovers`, {
            method: "POST",
            json: { amount: 1 },
        })
        expect(handover.status).toBe(404)
    })

    it("cancelled after the money came: owed back until «Вернул»", async () => {
        const paid = await json<Order>(await place())
        await payment(paid.id, "paid")
        await setStatus(paid.id, "cancelled")
        let report = await money()
        expect(report.refunds.map((o) => o.id)).toEqual([paid.id])
        await payment(paid.id, "refunded")
        // A second "refunded" is refused: it was already given back.
        expect((await payment(paid.id, "refunded")).status).toBe(422)
        report = await money()
        expect(report.refunds).toEqual([])

        // Sent, then cancelled by the customer: if the money comes, it is owed back.
        const late = await json<Order>(await place())
        await transferSent(late.id)
        await as(CUSTOMER)(`/api/orders/${late.id}`, {
            method: "PATCH",
            json: { status: "cancelled" },
        })
        const owed = await json<Order>(await payment(late.id, "paid"))
        expect(owed).toMatchObject({ status: "cancelled", payment: { status: "refund_due" } })
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
        expect(header?.split(";")).toHaveLength(15)
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
