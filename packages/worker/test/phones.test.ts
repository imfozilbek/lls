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
const COURIER_PHONE = "+998901112233"
const SHOP_PHONE = "+998901234501"
const OWNER_PHONE = "+998905550001"

interface Order {
    id: string
    courierPhone?: string
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

/**
 * Everyone on an order can call each other (owner's decision, October 2026): the owner and the
 * customer get the courier's number, the customer and the courier the shop's (its own number, or
 * the owner's while it has none), in the app and in the bots' messages.
 */
describe("phones: everyone on an order can call each other", () => {
    let client: TestClient
    let slug: string
    const owner = (): ReturnType<TestClient["as"]> =>
        client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const customer = (): ReturnType<TestClient["as"]> =>
        client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const courier = (): ReturnType<TestClient["as"]> => client.as(COURIER, { courierBot: true })

    async function placeOrder(): Promise<Order> {
        const product = await json<{ id: string }>(
            await owner()("/api/owner/products", {
                method: "POST",
                json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
            }),
        )
        await customer()("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const response = await customer()("/api/orders", {
            method: "POST",
            json: { items: [{ productId: product.id, quantity: 2 }], address: "Navoiy 12" },
        })
        expect(response.status).toBe(201)
        return json<Order>(response)
    }

    /** Paid and accepted, then given to the courier. */
    async function assigned(order: Order, courierId: string): Promise<Order> {
        await owner()(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        const response = await owner()(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { courierId },
        })
        expect(response.status).toBe(200)
        return json<Order>(response)
    }

    /** The owner's own Telegram number, as the shop bot hears it from a shared contact. */
    async function ownerSharesPhone(): Promise<void> {
        const row = await env.DB.prepare("SELECT webhook_secret FROM businesses WHERE bot_id = ?")
            .bind(SHOP_BOT.id)
            .first<{ webhook_secret: string }>()
        await client.request(`/tg/${SHOP_BOT.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-Bot-Api-Secret-Token": row?.webhook_secret ?? "",
            },
            body: JSON.stringify({
                message: {
                    from: OWNER,
                    chat: { id: OWNER.id },
                    contact: { phone_number: OWNER_PHONE, user_id: OWNER.id },
                },
            }),
        })
    }

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
    })

    it("the courier's number: in the order from assignment on, kept after delivery", async () => {
        const courierId = await hireCourier(client, { slug }, COURIER)
        const order = await placeOrder()
        expect((await assigned(order, courierId)).courierPhone).toBe(COURIER_PHONE)
        // Kept in D1: the customer reads it from their own order.
        const mine = await json<Order>(await customer()(`/api/orders/${order.id}`))
        expect(mine.courierPhone).toBe(COURIER_PHONE)

        // The owner's card in the shop bot names the courier with the number.
        const ownerCard = client.telegram.edited.filter((m) => m.chatId === OWNER.id).at(-1)
        expect(ownerCard?.html).toContain("Jasur, +998 90 111 22 33")

        for (const status of ["preparing", "ready"]) {
            await owner()(`/api/owner/orders/${order.id}`, { method: "PATCH", json: { status } })
        }
        await courier()(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        // On the way: the customer's message carries the courier's number.
        const onTheWay = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(onTheWay?.html).toContain("olib kelmoqda")
        expect(onTheWay?.html).toContain("📞 Kuryer: +998 90 111 22 33")

        await courier()(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "delivered" },
        })
        const delivered = await json<Order>(await customer()(`/api/orders/${order.id}`))
        expect(delivered.courierPhone).toBe(COURIER_PHONE)
    })

    it("the shop's number: its own for customers and couriers, else the owner's", async () => {
        await owner()("/api/owner/shop", { method: "PATCH", json: { contactPhone: null } })
        // Neither: no number to show, and no way to order yet («Tez orada…», `NO_SHOP_PHONE`).
        const none = await json<{ callPhone?: string; paymentMethods: string[] }>(
            await customer()("/api/shop"),
        )
        expect(none).not.toHaveProperty("callPhone")
        expect(none.paymentMethods).toEqual([])
        // The owner shared their own number: it stands in for the shop's.
        await ownerSharesPhone()
        expect(await json(await customer()("/api/shop"))).toMatchObject({ callPhone: OWNER_PHONE })
        // The shop's own number wins.
        await owner()("/api/owner/shop", { method: "PATCH", json: { contactPhone: SHOP_PHONE } })
        expect(await json(await customer()("/api/shop"))).toMatchObject({
            callPhone: SHOP_PHONE,
            contactPhone: SHOP_PHONE,
        })

        const courierId = await hireCourier(client, { slug }, COURIER)
        const order = await placeOrder()
        // The customer's first message about the order: the shop's number under the card.
        const first = client.telegram.sent.find(
            (m) => m.chatId === CUSTOMER.id && m.html.includes("#1"),
        )
        expect(first?.html).toContain("📞 Do'kon: +998 90 123 45 01")

        await assigned(order, courierId)
        // The courier's card and screen: the shop's number next to the customer's.
        const card = client.telegram.sent.find(
            (m) => m.chatId === COURIER.id && m.html.includes("#1"),
        )
        expect(card?.token).toBe(env.COURIER_BOT_TOKEN)
        expect(card?.html).toContain("+998 90 123 45 67")
        expect(card?.html).toContain("📞 Do'kon: +998 90 123 45 01")
        const home = await json<{ orders: { shopPhone?: string; customerPhone?: string }[] }>(
            await courier()("/api/courier/home"),
        )
        expect(home.orders[0]).toMatchObject({
            shopPhone: SHOP_PHONE,
            customerPhone: "+998901234567",
        })
    })
})

describe("no phone, no orders (owner's decision, October 2026)", () => {
    let client: TestClient
    let slug: string
    const owner = (): ReturnType<TestClient["as"]> =>
        client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const customer = (): ReturnType<TestClient["as"]> =>
        client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })

    async function product(): Promise<string> {
        const created = await json<{ id: string }>(
            await owner()("/api/owner/products", {
                method: "POST",
                json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
            }),
        )
        return created.id
    }

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
    })

    it("a working courier who never sent a phone gets no order and is asked again", async () => {
        const courierId = await hireCourier(client, { slug }, COURIER)
        // A courier approved before the rule, without a phone.
        await env.DB.prepare("UPDATE courier_profiles SET phone = NULL WHERE telegram_id = ?")
            .bind(COURIER.id)
            .run()
        const listed = await json<{ id: string; unavailableReason: string | null }[]>(
            await owner()("/api/owner/couriers"),
        )
        expect(listed.find((c) => c.id === courierId)?.unavailableReason).toBe("no_phone")

        const productId = await product()
        await customer()("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const order = await json<Order>(
            await customer()("/api/orders", {
                method: "POST",
                json: { items: [{ productId, quantity: 1 }], address: "Navoiy 12" },
            }),
        )
        await owner()(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        const refused = await owner()(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { courierId },
        })
        expect(refused.status).toBe(422)
        expect(await json(refused)).toMatchObject({
            error: { code: "COURIER_NOT_AVAILABLE", details: { reason: "no_phone" } },
        })

        // `/start` in the courier bot asks for the phone with the button.
        await client.courierBot({
            message: { from: COURIER, chat: { id: COURIER.id }, text: "/start" },
        })
        const ask = client.telegram.sent.filter((m) => m.chatId === COURIER.id).at(-1)
        expect(ask?.html).toContain("Raqamsiz buyurtma kelmaydi")
        expect(ask?.options?.askContact).toBeTruthy()

        // The phone arrives: the order can go to them.
        await client.courierBot({
            message: {
                from: COURIER,
                chat: { id: COURIER.id },
                contact: { phone_number: COURIER_PHONE, user_id: COURIER.id },
            },
        })
        const given = await owner()(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { courierId },
        })
        expect(given.status).toBe(200)
    })

    it("a shop with no number of its own or the owner's takes no orders", async () => {
        await owner()("/api/owner/shop", { method: "PATCH", json: { contactPhone: null } })
        const productId = await product()
        await customer()("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const refused = await customer()("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 1 }], address: "Navoiy 12" },
        })
        expect(refused.status).toBe(422)
        expect(await json(refused)).toMatchObject({ error: { code: "NO_SHOP_PHONE" } })
    })
})
