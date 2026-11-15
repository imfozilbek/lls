import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    PIN,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    sendReceipt,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

interface Order {
    id: string
    status: string
    total: number
    subtotal: number
    items: { line: number; name: string }[]
    removedItems?: { line: number; name: string }[]
    payment: { refundOwed?: number; owedBack?: number; status: string }
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

/**
 * «Yo'q» (owner's decision, November 2026): until «Tayyor» the owner takes out a line the shop did
 * not have. The sum goes down, a paid transfer owes the difference back until «Qaytardim», the
 * customer hears the new sum; «Bugun sotuvdan olib qo'yish» stops the product for today.
 */
describe("«Yo'q»: a line the shop did not have", () => {
    let client: TestClient
    let slug: string
    let osh: string
    let somsa: string
    const owner = (user: object = OWNER): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const customer = (): ReturnType<TestClient["as"]> =>
        client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })

    const product = async (name: string, price: number): Promise<string> => {
        const created = await owner()("/api/owner/products", {
            method: "POST",
            json: { name, price, unit: "pcs", category: "meals", stock: 10 },
        })
        expect(created.status).toBe(201)
        return (await json<{ id: string }>(created)).id
    }

    /** Osh 2 × 35 000 and Somsa 8 000, paid by transfer and accepted. */
    async function paidOrder(): Promise<Order> {
        const placed = await customer()("/api/orders", {
            method: "POST",
            json: {
                items: [
                    { productId: osh, quantity: 2 },
                    { productId: somsa, quantity: 1 },
                ],
                address: "Navoiy 12",
                location: PIN,
            },
        })
        expect(placed.status).toBe(201)
        const order = await json<Order>(placed)
        await sendReceipt(customer(), order.id)
        const paid = await owner()(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        expect(paid.status).toBe(200)
        return json<Order>(paid)
    }

    const remove = (orderId: string, line: number, stop = false, user: object = OWNER) =>
        owner(user)(`/api/owner/orders/${orderId}/items/${line}?stop=${stop ? 1 : 0}`, {
            method: "DELETE",
        })

    const refunds = async (): Promise<Order[]> =>
        (await json<{ refunds: Order[] }>(await owner()("/api/owner/money?period=today"))).refunds

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        osh = await product("Osh", 35_000)
        somsa = await product("Somsa", 8_000)
        await customer()("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
    })

    it("Somsa out: a lower sum, owed back, the customer told, off sale today", async () => {
        const order = await paidOrder()
        const before = order.total
        const response = await remove(order.id, 1, true)
        expect(response.status).toBe(200)
        const after = await json<Order>(response)
        expect(after.items.map((i) => i.name)).toEqual(["Osh"])
        expect(after.removedItems).toMatchObject([{ line: 1, name: "Somsa" }])
        expect(after.total).toBe(before - 8_000)
        expect(after.payment).toMatchObject({ refundOwed: 8_000, owedBack: 8_000 })
        // Stored: the line marked, the sums and the debt rewritten.
        const line = await env.DB.prepare(
            "SELECT removed_at FROM order_items WHERE order_id = ? AND line = 1",
        )
            .bind(order.id)
            .first<{ removed_at: number | null }>()
        expect(line?.removed_at).toBeGreaterThan(0)
        const row = await env.DB.prepare("SELECT total, refund_owed FROM orders WHERE id = ?")
            .bind(order.id)
            .first()
        expect(row).toEqual({ total: before - 8_000, refund_owed: 8_000 })
        // The customer hears it from the shop's bot.
        const told = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(told?.html).toContain("Somsa do'konda yo'q ekan")
        expect(told?.html).toContain("8 000 so'm qaytaradi")
        // «Bugun sotuvdan olib qo'yish»: off the shelf today, its count 0.
        const stopped = await env.DB.prepare(
            "SELECT unavailable_until, stock FROM products WHERE id = ?",
        )
            .bind(somsa)
            .first<{ unavailable_until: number | null; stock: number }>()
        expect(stopped?.unavailable_until).toBeGreaterThan(Date.now())
        expect(stopped?.stock).toBe(0)

        // «Pul» → «Qaytarish», then «Qaytardim».
        expect(await refunds()).toMatchObject([{ id: order.id, payment: { owedBack: 8_000 } }])
        const refunded = await owner()(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "refunded" },
        })
        expect(refunded.status).toBe(200)
        expect(await refunds()).toEqual([])
    })

    it("refused: the last line, after «Tayyor», twice the same line, by a stranger", async () => {
        const order = await paidOrder()
        expect((await remove(order.id, 1, false, STRANGER)).status).toBe(403)
        expect((await remove(order.id, 1)).status).toBe(200)
        expect((await remove(order.id, 1)).status).toBe(404)
        const last = await remove(order.id, 0)
        expect(last.status).toBe(422)
        expect(await json(last)).toMatchObject({ error: { code: "LAST_LINE" } })
        expect((await remove("no-such-order", 0)).status).toBe(404)
        // Without the switch the product stays on sale.
        const shelf = await env.DB.prepare("SELECT unavailable_until FROM products WHERE id = ?")
            .bind(somsa)
            .first<{ unavailable_until: number | null }>()
        expect(shelf?.unavailable_until).toBeNull()

        const ready = await paidOrder()
        const step = (status: string) =>
            owner()(`/api/owner/orders/${ready.id}`, { method: "PATCH", json: { status } })
        await step("preparing")
        await owner()(`/api/owner/orders/${ready.id}/courier`, {
            method: "PUT",
            json: { self: true },
        })
        expect((await step("ready")).status).toBe(200)
        const late = await remove(ready.id, 1)
        expect(late.status).toBe(422)
        expect(await json(late)).toMatchObject({ error: { code: "LINE_NOT_REMOVABLE" } })
    })

    it("cancelled after «Yo'q»: everything the customer paid is owed, once", async () => {
        const order = await paidOrder()
        const paidTotal = order.total
        await remove(order.id, 1)
        await owner()(`/api/owner/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "cancelled", reason: "Do'kon yopildi" },
        })
        expect(await refunds()).toMatchObject([{ id: order.id, payment: { owedBack: paidTotal } }])
        await owner()(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "refunded" },
        })
        expect(await refunds()).toEqual([])
    })
})
