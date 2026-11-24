import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    hireCourier,
    sendReceipt,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

/** The toy shop's «courier», who sends parcels on by a taxi or the post. */
const DISPATCHER = { id: 5005, first_name: "Dilshod", language_code: "uz" }
const PIN = { latitude: 38.9785, longitude: 66.6831 }

interface Order {
    id: string
    number: number
    status: string
    dispatcher: boolean
    needsCourierChoice: boolean
    ownerDelivers: boolean
    sentVia?: string
    deliveryFee: number
    customerPaysCarrier: boolean
    deliveryNotes: { at: string; text: string }[]
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("a dispatcher sends the order on and keeps the customer told", () => {
    let client: TestClient
    let slug: string
    let courierId: string

    const owner = (): ReturnType<TestClient["as"]> =>
        client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const dispatcherApp = (user: object = DISPATCHER): ReturnType<TestClient["as"]> =>
        client.as(user, { courierBot: true })

    async function placePaidOrder(): Promise<Order> {
        const product = await json<{ id: string }>(
            await owner()("/api/owner/products", {
                method: "POST",
                json: {
                    name: "Mantiqiy kubik",
                    price: 90_000,
                    unit: "pcs",
                    category: "logic_games",
                },
            }),
        )
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        await customer("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const placed = await customer("/api/orders", {
            method: "POST",
            json: {
                items: [{ productId: product.id, quantity: 1 }],
                address: "Qarshi, Navoiy 12",
                location: PIN,
            },
        })
        expect(placed.status).toBe(201)
        const order = await json<Order>(placed)
        // «Pul keldi» after the screenshot accepts it, «Yig'ishni boshlash» starts it.
        await sendReceipt(customer, order.id)
        const paid = await owner()(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        expect(paid.status).toBe(200)
        const started = await owner()(`/api/owner/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "preparing" },
        })
        expect(started.status).toBe(200)
        return json<Order>(started)
    }

    const step = (order: Order, status: string): Promise<Response> =>
        owner()(`/api/owner/orders/${order.id}`, { method: "PATCH", json: { status } })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        courierId = await hireCourier(client, { slug }, DISPATCHER)
    })

    it("the owner marks a courier as the dispatcher; nobody else can", async () => {
        const stranger = client.as(STRANGER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const refused = await stranger(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { dispatcher: true },
        })
        expect(refused.status).toBe(403)
        const response = await owner()(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { dispatcher: true },
        })
        expect(response.status).toBe(200)
        expect(await json<{ dispatcher: boolean }>(response)).toMatchObject({ dispatcher: true })
        const stored = await env.DB.prepare("SELECT dispatcher FROM couriers WHERE id = ?")
            .bind(courierId)
            .first<{ dispatcher: number }>()
        expect(stored?.dispatcher).toBe(1)
    })

    it("the only courier gets it by itself; pack, «Jo'natdim» by post, a note, delivered", async () => {
        await owner()(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { dispatcher: true },
        })
        const order = await placePaidOrder()
        // The shop's one courier is chosen by itself with «Pul keldi» (owner's decision).
        expect(order).toMatchObject({
            status: "preparing",
            dispatcher: true,
            needsCourierChoice: false,
        })
        // The dispatcher's card: where from and where to, from the courier bot.
        const assigned = client.telegram.sent.filter((m) => m.chatId === DISPATCHER.id).at(-1)
        expect(assigned?.token).toBe(env.COURIER_BOT_TOKEN)
        expect(assigned?.html).toContain("Qayerdan")
        expect(assigned?.html).toContain("Qarshi, Navoiy 12")
        expect((await step(order, "ready")).status).toBe(200)

        // The bot card's step opens the app: the way and the note are asked there. «Tayyor»
        // brings the card again, with a sound.
        const ready = client.telegram.sent.filter((m) => m.chatId === DISPATCHER.id).at(-1)
        const send = ready?.options?.keyboard?.inline_keyboard[0]?.[0]
        expect(send?.text).toBe("📮 Jo'natdim")
        expect(send?.web_app?.url).toContain(order.id)
        // A bare «Oldim» is refused, from the app or an old button.
        const bare = await dispatcherApp()(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        expect(bare.status).toBe(422)

        const stranger = await dispatcherApp(STRANGER)(`/api/courier/orders/${order.id}/send`, {
            method: "POST",
            json: { via: "post", note: "Trek: UZ123456" },
        })
        expect(stranger.status).toBe(403)
        const told = client.telegram.sent.length
        const sent = await dispatcherApp()(`/api/courier/orders/${order.id}/send`, {
            method: "POST",
            json: { via: "post", note: "Trek: UZ123456" },
        })
        expect(sent.status).toBe(200)
        expect(await json<Order>(sent)).toMatchObject({
            status: "picked_up",
            sentVia: "post",
            deliveryNotes: [{ text: "Trek: UZ123456" }],
        })
        const toCustomer = client.telegram.sent.slice(told).find((m) => m.chatId === CUSTOMER.id)
        expect(toCustomer?.token).toBe(SHOP_BOT_TOKEN)
        expect(toCustomer?.html).toContain("pochta orqali jo'natildi")
        expect(toCustomer?.html).toContain("Trek: UZ123456")
        expect(toCustomer?.html).toContain("Dispetcher")

        // The owner has no «Jo'natish» and no «Yetkazildi» on the card of a dispatcher's order.
        const ownerCard = client.telegram.edited.filter((m) => m.chatId === OWNER.id).at(-1)
        expect(ownerCard?.html).toContain("Dispetcher")
        expect(ownerCard?.html).toContain("pochta orqali")
        const ownerButtons = ownerCard?.options?.keyboard?.inline_keyboard.flat() ?? []
        expect(ownerButtons.some((b) => b.callback_data?.startsWith("a:"))).toBe(false)

        const noteSent = client.telegram.sent.length
        const noted = await dispatcherApp()(`/api/courier/orders/${order.id}/notes`, {
            method: "POST",
            json: { text: "Qarshiga yetdi, ertaga olib boriladi" },
        })
        expect(noted.status).toBe(201)
        expect((await json<Order>(noted)).deliveryNotes).toHaveLength(2)
        // The note rings as the customer's new message, the one before goes.
        const note = client.telegram.sent.slice(noteSent).find((m) => m.chatId === CUSTOMER.id)
        const lines = note?.html.split("\n") ?? []
        expect(lines.slice(0, 2)).toEqual([
            `📝 #${order.number} buyurtma: Qarshiga yetdi, ertaga olib boriladi`,
            "🚚 Yo'lda",
        ])
        // The earlier note stays on it; the new one is not said twice.
        expect(lines).toContain("📝 Trek: UZ123456")
        expect(lines.filter((l) => l.includes("Qarshiga yetdi"))).toHaveLength(1)
        expect(client.telegram.removed.at(-1)?.chatId).toBe(CUSTOMER.id)

        const done = await dispatcherApp()(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "delivered" },
        })
        expect(await json<Order>(done)).toMatchObject({ status: "delivered" })
        const closed = await dispatcherApp()(`/api/courier/orders/${order.id}/notes`, {
            method: "POST",
            json: { text: "Rahmat" },
        })
        expect(closed.status).toBe(422)
        // Stored and read back: the way and both notes.
        const stored = await env.DB.prepare(
            "SELECT dispatcher, sent_via, delivery_notes FROM orders WHERE id = ?",
        )
            .bind(order.id)
            .first<{ dispatcher: number; sent_via: string; delivery_notes: string }>()
        expect(stored).toMatchObject({ dispatcher: 1, sent_via: "post" })
        expect(JSON.parse(stored?.delivery_notes ?? "[]")).toHaveLength(2)
    })

    it("two couriers: «Tayyor» waits until the owner hands it to one", async () => {
        await hireCourier(client, { slug }, { id: 6006, first_name: "Bobur", language_code: "uz" })
        const order = await placePaidOrder()
        expect(order).toMatchObject({ needsCourierChoice: true })
        const early = await step(order, "ready")
        expect(early.status).toBe(422)
        expect(await json<{ error: { code: string } }>(early)).toMatchObject({
            error: { code: "COURIER_NOT_CHOSEN" },
        })
        const card = client.telegram.edited.filter((m) => m.chatId === OWNER.id).at(-1)
        const buttons = card?.options?.keyboard?.inline_keyboard.flat() ?? []
        expect(buttons.map((b) => b.text)).toContain("🛵 Kuryerga topshirish")
        expect(buttons.some((b) => b.callback_data === `a:${order.id}:ready`)).toBe(false)
        await owner()(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { courierId },
        })
        expect((await step(order, "ready")).status).toBe(200)
    })

    it("bad bodies are refused before any change", async () => {
        const order = await placePaidOrder()
        for (const json of [{ via: "pigeon" }, { via: "post", note: "x".repeat(301) }, {}]) {
            const response = await dispatcherApp()(`/api/courier/orders/${order.id}/send`, {
                method: "POST",
                json,
            })
            expect(response.status).toBe(400)
        }
        const empty = await dispatcherApp()(`/api/courier/orders/${order.id}/notes`, {
            method: "POST",
            json: { text: "   " },
        })
        expect(empty.status).toBe(400)
    })

    it("«O'zim yetkazaman» gives the owner's own steps back", async () => {
        const order = await placePaidOrder()
        const mine = await owner()(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { self: true },
        })
        expect(mine.status).toBe(200)
        expect(await json<Order>(mine)).toMatchObject({
            ownerDelivers: true,
            needsCourierChoice: false,
        })
        for (const status of ["ready", "picked_up", "delivered"]) {
            expect((await step(order, status)).status).toBe(200)
        }
    })

    it("a cash order never goes to a dispatcher", async () => {
        await owner()(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { dispatcher: true },
        })
        await owner()("/api/owner/shop", { method: "PATCH", json: { paymentOptions: "cash" } })
        const product = await json<{ id: string }>(
            await owner()("/api/owner/products", {
                method: "POST",
                json: { name: "Kubik", price: 50_000, unit: "pcs", category: "logic_games" },
            }),
        )
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        await customer("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const order = await json<Order>(
            await customer("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId: product.id, quantity: 1 }],
                    address: "Navoiy 12",
                    location: PIN,
                    paymentMethod: "cash",
                },
            }),
        )
        expect((await step(order, "accepted")).status).toBe(200)
        const handed = await owner()(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { courierId },
        })
        expect(handed.status).toBe(422)
        expect(await json<{ error: { code: string } }>(handed)).toMatchObject({
            error: { code: "CASH_NOT_FOR_DISPATCHER" },
        })
    })

    it("«Narxi keyin aytiladi»: no fee, said first, the price comes with «Jo'natdim»", async () => {
        await owner()(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { dispatcher: true },
        })
        const saved = await owner()("/api/owner/shop", {
            method: "PATCH",
            json: { delivery: { fee: 10_000, price: "later" } },
        })
        expect(saved.status).toBe(200)
        const shop = await json<{ delivery: { fee: number; price: string } }>(
            await client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })("/api/shop"),
        )
        expect(shop.delivery).toMatchObject({ fee: 0, customerPaysCarrier: true, price: "later" })
        const told = client.telegram.sent.length
        const order = await placePaidOrder()
        expect(order).toMatchObject({ deliveryFee: 0, customerPaysCarrier: true })
        const first = client.telegram.sent.slice(told).find((m) => m.chatId === CUSTOMER.id)
        expect(first?.html).toContain("Yetkazib berish narxi jo'natilganda aytiladi")
        const card = client.telegram.sent.slice(told).find((m) => m.chatId === OWNER.id)
        expect(card?.html).toContain(
            "jo'natilganda ma'lum qilinadi, mijoz yetkazuvchiga o'zi to'laydi",
        )

        // The dispatcher tells the price: «Jo'natdim» without it is refused, whatever the way.
        expect((await step(order, "ready")).status).toBe(200)
        const bare = await dispatcherApp()(`/api/courier/orders/${order.id}/send`, {
            method: "POST",
            json: { via: "taxi" },
        })
        expect(bare.status).toBe(400)
        const before = client.telegram.sent.length
        const sent = await dispatcherApp()(`/api/courier/orders/${order.id}/send`, {
            method: "POST",
            json: { via: "taxi", note: "Taksi, 25 000 so'm" },
        })
        expect(sent.status).toBe(200)
        const news = client.telegram.sent.slice(before).find((m) => m.chatId === CUSTOMER.id)
        expect(news?.html).toContain("Taksi, 25 000 so'm")
        expect(news?.html).toContain("Yetkazish haqini yetkazuvchiga o'zingiz to'laysiz")
    })
})
