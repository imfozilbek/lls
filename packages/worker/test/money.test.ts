import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
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

/** Placing 101 orders one by one takes a few seconds, more with coverage on. */
const MANY_ORDERS_TIMEOUT_MS = 30_000

/** A JPEG as the app sends it: the transfer screenshot. */
const RECEIPT = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 1, 2])

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

    const payment = (id: string, action: "paid" | "refunded" | "rejected"): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${id}/payment`, { method: "PATCH", json: { action } })

    const transferSent = (
        id: string,
        user: object = CUSTOMER,
        picture: Uint8Array = RECEIPT,
    ): Promise<Response> =>
        as(user)(`/api/orders/${id}/transfer-sent`, {
            method: "POST",
            headers: { "Content-Type": "image/jpeg" },
            body: picture,
        })

    const courierApp = (path: string, init?: RequestInit & { json?: unknown }): Promise<Response> =>
        client.as(COURIER, { courierBot: true })(path, init)

    const money = async (): Promise<{
        totals: Json
        awaiting: Order[]
        refunds: Order[]
        courierCash: unknown[]
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
        // The owner hears of a new card from Zumda | Business, not from the shop bot.
        const fromZumda = (): string | undefined =>
            client.telegram.sent
                .filter((m) => m.chatId === OWNER.id && m.token === env.BUSINESS_BOT_TOKEN)
                .at(-1)?.html
        expect(fromZumda()).toContain("•••• 7893")
        expect(fromZumda()).toContain("yangi karta")
        const twice = await cards("", { method: "POST", json: SECOND_CARD })
        expect(await json(twice)).toMatchObject({ error: { code: "CARD_EXISTS" } })

        const before = await json<Order>(await place())
        expect(before.payment.card).toEqual({ number: "4111111111111111", holder: CARD.holder })

        list = await json<Cards>(await cards(`/${second}/payment`, { method: "PUT" }))
        expect(list.paymentCardId).toBe(second)
        expect(fromZumda()).toContain("mijozlar endi •••• 7893")
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

    it("«Я перевёл» brings the owner the screenshot; «Деньги пришли, принять» starts the shop", async () => {
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
        // The owner gets the screenshot itself, the sum and the card it should be on.
        const ping = client.telegram.photoFiles.at(-1)
        expect(ping).toMatchObject({ chatId: OWNER.id, token: SHOP_BOT_TOKEN })
        expect(ping?.html).toContain("80 000")
        expect(ping?.html).toContain("•••• 1111")
        expect(ping?.html).not.toContain("⚠️")
        const asks = ping?.options?.keyboard?.inline_keyboard.flat() ?? []
        expect(asks.map((b) => b.callback_data).filter(Boolean)).toEqual([
            `pc:${order.id}`,
            `pn:${order.id}`,
        ])
        // A new screenshot replaces the old one while the money is not confirmed.
        const before = client.telegram.photoFiles.length
        expect((await transferSent(order.id)).status).toBe(200)
        expect(client.telegram.photoFiles.length).toBe(before + 1)
        expect((await money()).awaiting.map((o) => o.id)).toEqual([order.id])

        // Not by hand: the shop starts only after the money.
        expect((await setStatus(order.id, "accepted")).status).toBe(422)
        const accepted = await json<Order>(await payment(order.id, "paid"))
        expect(accepted).toMatchObject({ status: "accepted", payment: { status: "paid" } })
        expect(client.telegram.sent.at(-1)).toMatchObject({ chatId: CUSTOMER.id })
        expect(client.telegram.sent.at(-1)?.html).toContain("To'lov keldi")
        expect((await money()).awaiting).toEqual([])
        // Pressed again: nothing left to confirm.
        expect((await payment(order.id, "paid")).status).toBe(422)
    })

    it("the screenshot: required, private; a reused one and refused transfers warn", async () => {
        const first = await json<Order>(await place())
        const empty = await transferSent(first.id, CUSTOMER, new Uint8Array())
        expect(empty.status).toBe(422)
        expect(await json(empty)).toMatchObject({ error: { code: "RECEIPT_REQUIRED" } })
        expect((await as(CUSTOMER)(`/api/orders/${first.id}/receipt`)).status).toBe(404)
        const text = await as(CUSTOMER)(`/api/orders/${first.id}/transfer-sent`, {
            method: "POST",
            headers: { "Content-Type": "text/html" },
            body: "<script>",
        })
        expect(text.status).toBe(415)

        expect((await transferSent(first.id)).status).toBe(200)
        for (const user of [CUSTOMER, OWNER]) {
            const shown = await as(user)(`/api/orders/${first.id}/receipt`)
            expect(shown.status).toBe(200)
            expect(shown.headers.get("Cache-Control")).toBe("private, no-store")
            expect(new Uint8Array(await shown.arrayBuffer())).toEqual(RECEIPT)
        }
        const stranger = await as(STRANGER)(`/api/orders/${first.id}/receipt`)
        expect([403, 404]).toContain(stranger.status)
        // The order says when, never where the file lies.
        const dto = await json<Json>(await as(CUSTOMER)(`/api/orders/${first.id}`))
        expect(dto).toMatchObject({ payment: { receipt: { customerRejections: 0 } } })
        expect(JSON.stringify(dto)).not.toContain("receipts/")

        // «Pul kelmadi»: unpaid again, the customer hears it; only from «awaiting».
        const rejected = await json<Order & { payment: Json }>(await payment(first.id, "rejected"))
        expect(rejected.payment).toMatchObject({ status: "unpaid", rejections: 1 })
        const told = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(told?.html).toContain("pulni topmadi")
        const twice = await payment(first.id, "rejected")
        expect(twice.status).toBe(422)
        expect(await json(twice)).toMatchObject({ error: { code: "PAYMENT_NOT_REJECTABLE" } })

        // The same screenshot for another order: the owner is warned twice over.
        const second = await json<Order>(await place())
        await transferSent(second.id)
        const warned = client.telegram.photoFiles.at(-1)?.html
        expect(warned).toContain(`avval #${first.number} buyurtmada`)
        expect(warned).toContain("1 ta o'tkazmasi avval topilmagan")
    })

    it("«Do'konga eslatish»: not before the pause, then the owner is asked again", async () => {
        const order = await json<Order>(await place())
        await transferSent(order.id)
        const remind = (): Promise<Response> =>
            as(CUSTOMER)(`/api/orders/${order.id}/transfer-reminder`, { method: "POST" })
        const early = await remind()
        expect(early.status).toBe(422)
        expect(await json(early)).toMatchObject({ error: { code: "REMIND_TOO_SOON" } })
        // Eleven minutes and no answer from the shop.
        await env.DB.prepare("UPDATE orders SET receipt_at = ? WHERE id = ?")
            .bind(Date.now() - 11 * 60_000, order.id)
            .run()
        const reminded = await remind()
        expect(reminded.status).toBe(200)
        const body = await json<Order & { payment: { remindableAt?: string } }>(reminded)
        expect(Date.parse(body.payment.remindableAt ?? "")).toBeGreaterThan(Date.now())
        const ping = client.telegram.sent.at(-1)
        expect(ping).toMatchObject({ chatId: OWNER.id, token: SHOP_BOT_TOKEN })
        expect(ping?.html).toContain("tekshirishingizni kutmoqda")
        expect(ping?.options?.keyboard?.inline_keyboard.flat()[0]?.callback_data).toBe(
            `pc:${order.id}`,
        )
        expect((await remind()).status).toBe(422)
        // Only the order's customer may remind.
        const stranger = await as(STRANGER)(`/api/orders/${order.id}/transfer-reminder`, {
            method: "POST",
        })
        expect(stranger.status).toBe(403)
    })

    it("Telegram refuses the picture: the owner still gets the sum and the buttons", async () => {
        const order = await json<Order>(await place())
        client.telegram.failPhotos = true
        expect((await transferSent(order.id)).status).toBe(200)
        const ping = client.telegram.sent.at(-1)
        expect(ping).toMatchObject({ chatId: OWNER.id, token: SHOP_BOT_TOKEN })
        expect(ping?.html).toContain("80 000")
        const asks = ping?.options?.keyboard?.inline_keyboard.flat() ?? []
        expect(asks.map((b) => b.callback_data)).toContain(`pc:${order.id}`)
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
        expect(buttons.map((b) => b.callback_data ?? b.web_app?.url)).toEqual([
            `a:${order.id}:delivered`,
            "https://delivery.zumda.test/?mode=courier",
        ])
        expect(card?.html).toContain("mijozdan pul olmang")

        await client.courierBot({
            callback_query: { id: "cb-1", from: COURIER, data: `a:${order.id}:delivered` },
        })
        const home = await json<{ shops: Json[] }>(await courierApp("/api/courier/home"))
        expect(home.shops[0]).toMatchObject({ cashToHand: 0 })
        const report = await money()
        expect(report.totals).toEqual({
            placed: 1,
            delivered: 1,
            cancelled: 0,
            goods: 70_000,
            delivery: 10_000,
            deposits: 0,
            paid: 80_000,
            paidCash: 0,
            commission: 0,
        })
        expect(report.courierCash).toEqual([])
        // Cash is handed over per order, never as a lump sum.
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
        expect(header?.split(";")).toHaveLength(16)
        expect(row).toContain(";80000;karta;")

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

    it(
        "a month of more than 100 orders exports; text never runs as a formula",
        async () => {
            for (let i = 0; i < 101; i++) {
                expect((await place()).status).toBe(201)
            }
            await env.DB.prepare("UPDATE orders SET address = '=HYPERLINK(\"http://x\")'").run()
            await env.DB.prepare("UPDATE businesses SET name = 'Tom & Jerry'").run()
            const sent = await as(OWNER)("/api/owner/money/export?period=month", { method: "POST" })
            expect(await json(sent)).toEqual({ sent: 101 })
            const csv = client.telegram.documents.at(-1)
            // The shop's name is escaped in the HTML caption, or Telegram refuses the file.
            expect(csv?.caption).toContain("Tom &amp; Jerry")
            const rows = new TextDecoder().decode(csv?.file.bytes).split("\r\n").slice(1)
            expect(rows.filter((row) => row.length > 0)).toHaveLength(101)
            expect(rows[0]).toContain(`"'=HYPERLINK(""http://x"")"`)
            // 101 real orders through the API: slow under coverage, never stuck.
        },
        MANY_ORDERS_TIMEOUT_MS,
    )

    it("the owner deleted the order card: a new one comes, the customer still hears", async () => {
        const order = await json<Order>(await place())
        const card = await env.DB.prepare("SELECT owner_message_id FROM orders WHERE id = ?")
            .bind(order.id)
            .first<{ owner_message_id: number }>()
        client.telegram.deletedMessages.add(card?.owner_message_id ?? -1)
        const before = client.telegram.sent.length
        expect((await payment(order.id, "paid")).status).toBe(200)
        const after = client.telegram.sent.slice(before)
        expect(after.some((m) => m.chatId === CUSTOMER.id)).toBe(true)
        expect(
            after.some((m) => m.chatId === OWNER.id && m.html.includes(`#${order.number}`)),
        ).toBe(true)
        const fresh = await env.DB.prepare("SELECT owner_message_id FROM orders WHERE id = ?")
            .bind(order.id)
            .first<{ owner_message_id: number }>()
        expect(fresh?.owner_message_id).not.toBe(card?.owner_message_id)
    })

    it("only the owner sees the shop's money", async () => {
        expect((await as(CUSTOMER)("/api/owner/money")).status).toBe(403)
        expect((await as(COURIER)("/api/owner/money")).status).toBe(403)
        expect((await as(CUSTOMER)("/api/courier/home")).status).toBe(403)
        expect((await as(OWNER)("/api/owner/money?period=year")).status).toBe(400)
    })
})
