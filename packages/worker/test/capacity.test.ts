/**
 * What each screen's request costs in D1 rows read (the free plan's daily limit is 5M for the
 * whole account, Zumda's share 1.5M): measured on a shop with six months of history, so a query
 * that walks the history instead of an index range fails here. docs/capacity.md multiplies these
 * by the day's requests.
 */
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

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
import { countingDb } from "./rows-read.js"

import type { TestClient } from "./helpers.js"
import type { RowsCounter } from "./rows-read.js"

type Caller = ReturnType<TestClient["as"]>

const COURIER = { id: 5005, first_name: "Sardor" }
/** Six months of one busy shop: 30 orders a day. */
const HISTORY = 30 * 180
const OPEN_ORDERS = 10
const PRODUCTS = 40
const MINUTE_MS = 60_000
/** Seeding six months takes a few seconds, more with coverage on. */
const SEED_TIMEOUT_MS = 60_000

/**
 * `count` copies of the rows of `table` matching `where`, each column set by `overrides` (SQL over
 * `n.i`, 1..count) or copied. One statement: a recursive CTE, no round trips.
 */
async function clone(
    table: string,
    where: string,
    binds: unknown[],
    count: number,
    overrides: Record<string, string>,
): Promise<void> {
    const { results } = await env.DB.prepare(`SELECT name FROM pragma_table_info('${table}')`).all<{
        name: string
    }>()
    const columns = results.map((row) => row.name)
    for (const column of Object.keys(overrides)) {
        expect(columns).toContain(column)
    }
    const values = columns.map((column) => overrides[column] ?? `t.${column}`)
    await env.DB.prepare(
        `INSERT INTO ${table} (${columns.join(", ")})
         WITH RECURSIVE n (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${count})
         SELECT ${values.join(", ")} FROM ${table} AS t, n WHERE ${where}`,
    )
        .bind(...binds)
        .run()
}

/** A shop with a courier, a customer, six months of delivered orders and the day's open ones. */
async function seed(): Promise<{
    counter: RowsCounter
    client: TestClient
    owner: Caller
    customer: Caller
    courier: Caller
    productId: string
    orderId: string
    courierId: string
}> {
    const counter = countingDb(env.DB)
    const client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT }, db: counter.db })
    const shop = await createActiveShop(client)
    const owner = client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: shop.slug })
    const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: shop.slug })
    const courier = client.as(COURIER, { courierBot: true })

    const created = await owner("/api/owner/products", {
        method: "POST",
        json: { name: "To'y oshi", price: 45_000, unit: "portion", category: "meals" },
    })
    const { id: productId } = (await created.json()) as { id: string }
    await clone("products", "t.id = ?", [productId], PRODUCTS - 1, {
        id: "'p' || n.i",
        name: "'Taom ' || n.i",
        search_text: "' taom ' || n.i",
        position: "n.i",
    })
    const courierId = await hireCourier(client, shop, COURIER)
    await customer("/api/me")
    await sharePhoneWithShops(CUSTOMER.id)
    const placed = await customer("/api/orders", {
        method: "POST",
        json: { items: [{ productId, quantity: 2 }], address: "Navoiy 12" },
    })
    const { id: orderId } = (await placed.json()) as { id: string }
    await owner(`/api/owner/orders/${orderId}/payment`, {
        method: "PATCH",
        json: { action: "paid" },
    })
    await owner(`/api/owner/orders/${orderId}/courier`, {
        method: "PUT",
        json: { courierId },
    })

    // Six months delivered by this courier for this customer, and the day's open orders.
    const now = Date.now()
    const history = {
        id: "'h' || n.i",
        number: "1000 + n.i",
        status: "'delivered'",
        payment_status: "'paid'",
        created_at: `${now} - n.i * 48 * ${MINUTE_MS}`,
        updated_at: `${now} - n.i * 48 * ${MINUTE_MS}`,
        paid_at: `${now} - n.i * 48 * ${MINUTE_MS}`,
        delivered_at: `${now} - n.i * 48 * ${MINUTE_MS}`,
    }
    await clone("orders", "t.id = ?", [orderId], HISTORY, history)
    await clone("order_items", "t.order_id = ?", [orderId], HISTORY, {
        order_id: "'h' || n.i",
    })
    await clone("orders", "t.id = ?", [orderId], OPEN_ORDERS, {
        id: "'o' || n.i",
        number: "100 + n.i",
        status: "'preparing'",
    })
    await clone("order_items", "t.order_id = ?", [orderId], OPEN_ORDERS, {
        order_id: "'o' || n.i",
    })
    await env.DB.prepare("UPDATE businesses SET marketplace_commission_bps = 0 WHERE id = ?")
        .bind(shop.id)
        .run()

    return { counter, client, owner, customer, courier, productId, orderId, courierId }
}

describe("rows read per request, on six months of history", () => {
    it(
        "every polled or opened screen reads an index range, not the history",
        async () => {
            const { counter, client, owner, customer, courier, orderId } = await seed()
            const screens: [string, () => Promise<Response>, number][] = [
                ["customer: /api/me", () => customer("/api/me"), 10],
                ["customer: the shop", () => customer("/api/shop"), 10],
                ["customer: the menu, page 1", () => customer("/api/shop/products"), 120],
                [
                    "customer: an open order (polled 30 s)",
                    () => customer(`/api/orders/${orderId}`),
                    30,
                ],
                ["customer: my orders, page 1", () => customer("/api/orders"), 150],
                [
                    "owner: orders version (polled 20 s)",
                    () => owner("/api/owner/orders/version"),
                    30,
                ],
                ["owner: open orders", () => owner("/api/owner/orders?filter=active"), 120],
                ["owner: finished, page 1", () => owner("/api/owner/orders?filter=done"), 200],
                // OFFSET walks the pages before it: deep pages cost more, and are rare.
                [
                    "owner: finished, page 20",
                    () => owner("/api/owner/orders?filter=done&page=20"),
                    1500,
                ],
                ["owner: money today", () => owner("/api/owner/money"), 100],
                // The month so far: up to 30 days of 30 orders, never the months before.
                ["owner: money this month", () => owner("/api/owner/money?period=month"), 3000],
                ["courier: home (polled 45 s)", () => courier("/api/courier/home"), 300],
                [
                    "showcase: search «osh»",
                    () => client.as(CUSTOMER, {})("/api/showcase/products?q=osh"),
                    30,
                ],
            ]
            // Measured (docs/capacity.md); each limit leaves room, none follows the history.
            const measured: Record<string, number> = {}
            for (const [name, call, limit] of screens) {
                counter.take()
                const response = await call()
                expect(response.status, name).toBe(200)
                measured[name] = counter.take().read
                expect(measured[name], name).toBeLessThanOrEqual(limit)
            }
        },
        SEED_TIMEOUT_MS,
    )
    it(
        "one order from placing to delivered: rows read and written",
        async () => {
            const { counter, owner, customer, courier, productId, courierId } = await seed()
            counter.take()
            const placed = await customer("/api/orders", {
                method: "POST",
                json: { items: [{ productId, quantity: 1 }], address: "Navoiy 12" },
            })
            const { id } = (await placed.json()) as { id: string }
            const step = async (call: () => Promise<Response>): Promise<void> => {
                const response = await call()
                expect(response.status).toBe(200)
            }
            await step(() =>
                customer(`/api/orders/${id}/transfer-sent`, {
                    method: "POST",
                    headers: { "Content-Type": "image/jpeg" },
                    body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
                }),
            )
            await step(() =>
                owner(`/api/owner/orders/${id}/payment`, {
                    method: "PATCH",
                    json: { action: "paid" },
                }),
            )
            await step(() =>
                owner(`/api/owner/orders/${id}/courier`, { method: "PUT", json: { courierId } }),
            )
            for (const status of ["preparing", "ready"]) {
                await step(() =>
                    owner(`/api/owner/orders/${id}`, { method: "PATCH", json: { status } }),
                )
            }
            for (const status of ["picked_up", "delivered"]) {
                await step(() =>
                    courier(`/api/courier/orders/${id}`, { method: "PATCH", json: { status } }),
                )
            }
            const rows = counter.take()
            // Measured 91 read, 39 written (docs/capacity.md: about 300 such orders a day). A save
            // writes only what changed: every column on each step cost twice the writes.
            expect(rows.read).toBeLessThanOrEqual(150)
            expect(rows.written).toBeLessThanOrEqual(60)
        },
        SEED_TIMEOUT_MS,
    )
})
