import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { D1OrderRepository } from "../src/repositories/order.repository.js"

import {
    CUSTOMER,
    OWNER,
    PIN,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    hireCourier,
    sendReceipt,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

/**
 * Migration 0033: the customer's one live message per order, and the bot that holds the owner's
 * card (the shop's own, or Zumda | Business while the shop's bot may not write to the owner).
 */
describe("the messages of an order in D1", () => {
    let client: TestClient
    let orderId: string

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const { slug } = await createActiveShop(client)
        const as = (user: object): ReturnType<TestClient["as"]> =>
            client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const product = await json<{ id: string }>(
            await as(OWNER)("/api/owner/products", {
                method: "POST",
                json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
            }),
        )
        await as(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const order = await json<{ id: string }>(
            await as(CUSTOMER)("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId: product.id, quantity: 1 }],
                    address: "Navoiy 12",
                    location: PIN,
                },
            }),
        )
        orderId = order.id
    })

    it("keeps the customer's message and where the owner's card is", async () => {
        const orders = new D1OrderRepository(env.DB)
        const placed = await orders.getMessageIds(orderId)
        expect(placed.ownerVia).toBe("shop")
        await orders.setMessageId(orderId, "customer", 501)
        await orders.setMessageId(orderId, "owner", 502, "business")
        await orders.setMessageId(orderId, "courier", 503)
        expect(await orders.getMessageIds(orderId)).toEqual({
            owner: 502,
            ownerVia: "business",
            courier: 503,
            customer: 501,
        })
        // The shop's bot writes again: its new card is the one edited from now on.
        await orders.setMessageId(orderId, "owner", 504)
        expect(await orders.getMessageIds(orderId)).toMatchObject({ owner: 504, ownerVia: "shop" })
    })
})

const COURIER = { id: 5005, first_name: "Jasur", language_code: "uz" }

/** The customer's one live message per order (owner's decision, November 2026). */
describe("the customer's live message", () => {
    let client: TestClient
    let slug: string
    let productId: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const toCustomer = (): { sent: SentLike[]; edited: SentLike[]; removed: number[] } => ({
        sent: client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id),
        edited: client.telegram.edited.filter((m) => m.chatId === CUSTOMER.id),
        removed: client.telegram.removed
            .filter((m) => m.chatId === CUSTOMER.id)
            .map((m) => m.messageId),
    })
    const place = async (): Promise<{ id: string; number: number }> =>
        json(
            await as(CUSTOMER)("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId, quantity: 2 }],
                    address: "Navoiy 12",
                    landmark: "Maktab",
                    location: PIN,
                },
            }),
        )
    const setStatus = (id: string, status: string): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${id}`, { method: "PATCH", json: { status } })
    const payment = (id: string, action: string): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${id}/payment`, { method: "PATCH", json: { action } })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        const product = await json<{ id: string }>(
            await as(OWNER)("/api/owner/products", {
                method: "POST",
                json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
            }),
        )
        productId = product.id
        await as(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
    })

    it("one message for the whole way: what they wait for rings, the shop's work is quiet", async () => {
        await hireCourier(client, { slug }, COURIER)
        const order = await place()
        const placed = toCustomer().sent
        expect(placed).toHaveLength(1)
        expect(placed[0]?.options?.silent).toBe(false)
        expect(placed[0]?.html.split("\n")[0]).toBe(
            `🧾 #${order.number} buyurtma rasmiylashtirildi.`,
        )
        expect(placed[0]?.html).toContain("📍 Navoiy 12 (mo'ljal: Maktab)")
        expect(placed[0]?.html).toContain("<blockquote expandable>Osh × 2 porsiya: 70 000 so'm")

        // The screenshot: the same message, quietly.
        await sendReceipt(as(CUSTOMER), order.id)
        expect(toCustomer().sent).toHaveLength(1)
        expect(toCustomer().edited.at(-1)?.html).toContain(
            "Chek yuborildi. Do'kon pul kelganini tekshiryapti.",
        )

        // The owner's picture answers the order's card, the sum over it.
        const ownerCard = await env.DB.prepare("SELECT owner_message_id FROM orders WHERE id = ?")
            .bind(order.id)
            .first<{ owner_message_id: number }>()
        const photo = client.telegram.photoFiles.at(-1)
        expect(photo?.options).toMatchObject({
            replyTo: ownerCard?.owner_message_id,
            captionAbove: true,
        })

        // «Pul keldi»: a new message with a sound, the old one goes.
        await payment(order.id, "paid")
        const accepted = toCustomer()
        expect(accepted.sent).toHaveLength(2)
        expect(accepted.sent[1]?.html).toContain("qabul qilindi")
        expect(accepted.sent[1]?.options?.silent).toBe(false)
        expect(accepted.removed).toHaveLength(1)

        // Collecting and ready: quiet edits of that message.
        await setStatus(order.id, "preparing")
        await setStatus(order.id, "ready")
        expect(toCustomer().sent).toHaveLength(2)
        expect(toCustomer().edited.at(-1)?.html).toContain("tayyor")
        // The courier's card comes again on «Tayyor», with a sound; the one before goes.
        const ready = client.telegram.sent.filter((m) => m.chatId === COURIER.id).at(-1)
        expect(ready?.html.split("\n")[0]).toContain("📦 Tayyor")
        expect(ready?.options?.silent).toBe(false)
        expect(client.telegram.removed.some((m) => m.chatId === COURIER.id)).toBe(true)

        // On the way and delivered ring; each time one message stays.
        const courier = client.as(COURIER, { courierBot: true })
        for (const status of ["picked_up", "delivered"]) {
            await courier(`/api/courier/orders/${order.id}`, {
                method: "PATCH",
                json: { status },
            })
        }
        const done = toCustomer()
        expect(done.sent).toHaveLength(4)
        expect(done.sent[2]?.html).toContain("📞 Kuryer: +998 90 111 22 33")
        expect(done.sent[3]?.html).toContain("yetkazildi")
        expect(done.removed).toHaveLength(3)
        // Every message but the last was removed: the chat keeps one per order.
        const kept = await env.DB.prepare("SELECT customer_message_id FROM orders WHERE id = ?")
            .bind(order.id)
            .first<{ customer_message_id: number }>()
        expect(done.removed).not.toContain(kept?.customer_message_id)
    })

    it("the customer who cancels sees it quietly; the owner hears it", async () => {
        const order = await place()
        await as(CUSTOMER)(`/api/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "cancelled" },
        })
        expect(toCustomer().sent).toHaveLength(1)
        expect(toCustomer().edited.at(-1)?.html).toContain("bekor qilindi")
        const owner = client.telegram.sent.filter((m) => m.chatId === OWNER.id).at(-1)
        expect(owner?.html).toContain("Mijoz buyurtmani bekor qildi")
    })

    it("«Qaytardim» tells the customer what came back", async () => {
        const order = await place()
        await sendReceipt(as(CUSTOMER), order.id)
        await payment(order.id, "paid")
        await setStatus(order.id, "cancelled")
        await payment(order.id, "refunded")
        const last = toCustomer().sent.at(-1)
        expect(last?.html.split("\n")[0]).toBe(
            `↩️ #${order.number}: do'kon sizga 80 000 so'm qaytarib berdi.`,
        )
        expect(last?.options?.silent).toBe(false)
    })
})

interface SentLike {
    html: string
    options?: { silent?: boolean }
}
