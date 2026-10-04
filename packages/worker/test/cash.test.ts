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

const COURIER = { id: 5005, first_name: "Jasur", language_code: "uz" }

interface Json {
    [key: string]: unknown
}
interface Order {
    id: string
    number: number
    total: number
    status: string
    payment: { method: string; status: string; withCourier: boolean; cashReceivedAt?: string }
}
interface Report {
    totals: Json
    courierCash: { courierId: string; courierName: string; total: number; orders: Order[] }[]
}

async function json<T = Json>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("cash: chosen by the shop, collected by its courier, taken by the owner per order", () => {
    let client: TestClient
    let slug: string
    let courierId: string
    let productId: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const courierApp = (path: string, init?: RequestInit & { json?: unknown }): Promise<Response> =>
        client.as(COURIER, { courierBot: true })(path, init)

    const place = (paymentMethod?: string): Promise<Response> =>
        as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 2 }], address: "Navoiy 12", paymentMethod },
        })
    const setStatus = (id: string, status: string): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${id}`, { method: "PATCH", json: { status } })
    const options = (paymentOptions: string): Promise<Response> =>
        as(OWNER)("/api/owner/shop", { method: "PATCH", json: { paymentOptions } })
    const report = async (): Promise<Report> => json(await as(OWNER)("/api/owner/money"))

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

    it("a card shop refuses cash; an unknown option is a 400", async () => {
        const refused = await place("cash")
        expect(refused.status).toBe(422)
        expect(await json(refused)).toMatchObject({
            error: { code: "PAYMENT_METHOD_UNAVAILABLE" },
        })
        expect((await options("crypto")).status).toBe(400)
        expect((await place("bitcoin")).status).toBe(400)
    })

    it("a cash shop without a card takes orders; the customer is told to have the sum ready", async () => {
        await env.DB.prepare(
            `UPDATE businesses SET payout_card_number = NULL, payout_card_holder = NULL,
                payment_card_id = NULL`,
        ).run()
        const shop = await json<Json>(await options("cash"))
        expect(shop).toMatchObject({ paymentOptions: "cash", paymentMethods: ["cash"] })
        const storefront = await json<Json>(await as(CUSTOMER)("/api/shop"))
        expect(storefront).toMatchObject({ isOpen: true, paymentMethods: ["cash"] })

        const placed = await place()
        expect(placed.status).toBe(201)
        const order = await json<Order>(placed)
        expect(order.payment).toMatchObject({ method: "cash", status: "unpaid" })
        const toCustomer = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toCustomer?.html).toContain("kuryerga")
        expect(toCustomer?.html).toContain("80 000")
        const toOwner = client.telegram.sent.find(
            (m) => m.chatId === OWNER.id && m.html.includes(`#${order.number}`),
        )
        expect(toOwner?.html).toContain("Naqd")
        const step = toOwner?.options?.keyboard?.inline_keyboard[0]?.[0]
        expect(step?.callback_data).toBe(`a:${order.id}:accepted`)
    })

    it("accepted at once; the courier collects; the owner takes it per order", async () => {
        await options("both")
        const order = await json<Order>(await place("cash"))
        expect(
            (
                await as(CUSTOMER)(`/api/orders/${order.id}/transfer-sent`, {
                    method: "POST",
                    headers: { "Content-Type": "image/jpeg" },
                    body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]),
                })
            ).status,
        ).toBe(422)
        expect((await setStatus(order.id, "accepted")).status).toBe(200)
        // Cash never goes to the district network.
        const network = await as(OWNER)(`/api/owner/orders/${order.id}/network`, {
            method: "PUT",
        })
        expect(network.status).toBe(422)
        await as(OWNER)(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { courierId },
        })
        const card = client.telegram.sent.find(
            (m) => m.chatId === COURIER.id && m.html.includes(`#${order.number}`),
        )
        expect(card?.html).toContain("Mijozdan 80 000 so'm naqd oling")
        await setStatus(order.id, "preparing")
        await setStatus(order.id, "ready")
        await courierApp(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        const edited = client.telegram.edited.filter((m) => m.chatId === COURIER.id).at(-1)
        expect(edited?.options?.keyboard?.inline_keyboard[0]?.[0]?.text).toBe(
            "🏁 Pulni oldim, yetkazdim",
        )
        await client.courierBot({
            callback_query: { id: "cb-1", from: COURIER, data: `a:${order.id}:delivered` },
        })

        const home = await json<{ shops: Json[] }>(await courierApp("/api/courier/home"))
        expect(home.shops[0]).toMatchObject({ cashToHand: 80_000 })
        let money = await report()
        expect(money.totals).toMatchObject({ paid: 80_000, paidCash: 80_000 })
        expect(money.courierCash).toHaveLength(1)
        expect(money.courierCash[0]).toMatchObject({
            courierId,
            courierName: "Jasur",
            total: 80_000,
        })
        expect(money.courierCash[0]?.orders.map((o) => o.id)).toEqual([order.id])

        const taken = await as(OWNER)(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "cash_received" },
        })
        expect(taken.status).toBe(200)
        expect((await json<Order>(taken)).payment.withCourier).toBe(false)
        money = await report()
        expect(money.courierCash).toEqual([])
        const again = await as(OWNER)(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "cash_received" },
        })
        expect(await json(again)).toMatchObject({ error: { code: "CASH_NOT_WITH_COURIER" } })
        const after = await json<{ shops: Json[] }>(await courierApp("/api/courier/home"))
        expect(after.shops[0]).toMatchObject({ cashToHand: 0 })

        const sent = await as(OWNER)("/api/owner/money/export?period=month", { method: "POST" })
        expect(sent.status).toBe(200)
        const csv = new TextDecoder().decode(client.telegram.documents.at(-1)?.file.bytes)
        expect(csv).toContain(";80000;naqd;to'langan;")
    })
})
