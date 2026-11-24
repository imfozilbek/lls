/**
 * What each screen's request costs in D1 rows read (the free plan's daily limit is 5M for the
 * whole account, Zumda's share 1.5M): measured on a shop with six months of history, so a query
 * that walks the history instead of an index range fails here. docs/capacity.md multiplies these
 * by the day's requests.
 */
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import {
    ADMIN,
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
import { countingDb } from "./rows-read.js"

import type { TestClient } from "./helpers.js"
import type { RowsCounter } from "./rows-read.js"
import type { ChannelHistoryReader, HistoryPage } from "@zumda/core"

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
async function seed(pages?: ChannelHistoryReader): Promise<{
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
    const client = testClient({
        bots: { [SHOP_BOT_TOKEN]: SHOP_BOT },
        db: counter.db,
        ...(pages ? { history: pages } : {}),
    })
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
        json: { items: [{ productId, quantity: 2 }], address: "Navoiy 12", location: PIN },
    })
    const { id: orderId } = (await placed.json()) as { id: string }
    await sendReceipt(customer, orderId)
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
        // Every real screenshot is its own file: one hash per order, as in life.
        receipt_hash: "printf('%064d', n.i)",
    }
    await clone("orders", "t.id = ?", [orderId], HISTORY, history)
    await clone("order_items", "t.order_id = ?", [orderId], HISTORY, {
        order_id: "'h' || n.i",
    })
    await clone("orders", "t.id = ?", [orderId], OPEN_ORDERS, {
        id: "'o' || n.i",
        number: "100 + n.i",
        status: "'preparing'",
        receipt_hash: "printf('o%063d', n.i)",
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
                // Admins only, opened once in months: walks the people (a row or two each), never
                // their orders: a district of 1 000 customers reads about 2 000.
                [
                    "admin: «Qo'llanma» counts",
                    () => client.as(ADMIN, { adminBot: true })("/api/admin/guides"),
                    50,
                ],
                // The same: the live shops and their couriers, a row or two each.
                [
                    "admin: «Raqam so'rash» counts",
                    () => client.as(ADMIN, { adminBot: true })("/api/admin/phone-asks"),
                    50,
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
            // The customer came by an ad link: the order counts for it, its sale on delivery.
            const link = await owner("/api/owner/links", {
                method: "POST",
                json: { label: "Super kids" },
            })
            const { id: linkId } = (await link.json()) as { id: string }
            await env.DB.prepare(
                `INSERT INTO source_visits (business_id, telegram_id, link_id, at)
                 SELECT id, ?, ?, ? FROM businesses`,
            )
                .bind(CUSTOMER.id, linkId, Date.now())
                .run()
            counter.take()
            const placed = await customer("/api/orders", {
                method: "POST",
                json: { items: [{ productId, quantity: 1 }], address: "Navoiy 12", location: PIN },
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
            // «Pul keldi» accepted it; «Yig'ishni boshlash», then «Tayyor» (owner's decision,
            // November 2026: collecting is a step of its own).
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
            const counted = await env.DB.prepare(
                "SELECT orders, sales FROM source_links WHERE id = ?",
            )
                .bind(linkId)
                .first<{ orders: number; sales: number }>()
            expect(counted).toEqual({ orders: 1, sales: 1 })
            // Measured 120 read, 49 written with the link (docs/capacity.md: about 300 such orders
            // a day; the link: its visit read once, its counters written twice;
            // «Yig'ishni boshlash» is a step of its own; the customer's live message reads its id
            // on each step and writes it on each new message). A save writes only what changed: every
            // column on each step cost twice the writes.
            expect(rows.read).toBeLessThanOrEqual(150)
            expect(rows.written).toBeLessThanOrEqual(60)
        },
        SEED_TIMEOUT_MS,
    )
    it(
        "the shop's channel and its links: the screens, and one pressed link",
        async () => {
            const { counter, client, owner, productId } = await seed()
            const business = await env.DB.prepare(
                "SELECT id, webhook_secret FROM businesses",
            ).first<{ id: string; webhook_secret: string }>()
            await env.DB.prepare(
                `INSERT INTO shop_channels (business_id, chat_id, title, connected_at)
                 VALUES (?, -1001, 'ABC', 0)`,
            )
                .bind(business?.id)
                .run()
            const made = await owner("/api/owner/links", {
                method: "POST",
                json: { label: "Super kids", productId },
            })
            const { id: linkId } = (await made.json()) as { id: string }
            // A year of posts and ad links: the lists read one page, never all of them.
            await clone("source_links", "t.id = ?", [linkId], 500, {
                id: "'l' || n.i",
                kind: "CASE WHEN n.i % 2 = 0 THEN 'post' ELSE 'ad' END",
                chat_id: "-1001",
                message_id: "n.i",
                created_at: "n.i",
            })
            const screens: [string, () => Promise<Response>, number][] = [
                ["owner: the channel", () => owner("/api/owner/channel"), 10],
                ["owner: posts, page 1", () => owner("/api/owner/links?kind=post"), 40],
                ["owner: ad links, page 1", () => owner("/api/owner/links?kind=ad"), 40],
            ]
            for (const [name, call, limit] of screens) {
                counter.take()
                const response = await call()
                expect(response.status, name).toBe(200)
                expect(counter.take().read, name).toBeLessThanOrEqual(limit)
            }
            counter.take()
            const pressed = await client.request(`/tg/${SHOP_BOT.id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Telegram-Bot-Api-Secret-Token": business?.webhook_secret ?? "",
                },
                body: JSON.stringify({
                    update_id: 1,
                    message: {
                        message_id: 1,
                        from: CUSTOMER,
                        chat: { id: CUSTOMER.id, type: "private" },
                        date: 0,
                        text: `/start s_${linkId}`,
                    },
                }),
            })
            expect(pressed.status).toBe(200)
            const click = counter.take()
            // Measured 4 read, 2 written: the link, the visit (one upsert), the product (docs/capacity.md).
            expect(click.read).toBeLessThanOrEqual(15)
            expect(click.written).toBeLessThanOrEqual(4)
        },
        SEED_TIMEOUT_MS,
    )
    it(
        "every post of the channel: one post made in Telegram, one press of the past",
        async () => {
            // The channel's past: 40 posts on its pages, twenty a page, the newest first.
            const history: ChannelHistoryReader = {
                page: async (_username, before): Promise<HistoryPage> => {
                    const ids = Array.from({ length: 40 }, (_, i) => 2000 - i).filter(
                        (id) => before === undefined || id < before,
                    )
                    return {
                        posts: ids.slice(0, 20).map((id) => ({
                            messageId: id,
                            text: `Post ${id}`,
                            album: false,
                        })),
                        older: ids.length > 20,
                    }
                },
            }
            const { counter, client, owner } = await seed(history)
            const business = await env.DB.prepare(
                "SELECT id, webhook_secret FROM businesses",
            ).first<{ id: string; webhook_secret: string }>()
            await env.DB.prepare(
                `INSERT INTO shop_channels (business_id, chat_id, title, username, connected_at,
                    updates_version)
                 VALUES (?, -1001, 'ABC', 'abc_kanal', 0, 1)`,
            )
                .bind(business?.id)
                .run()
            counter.take()
            const posted = await client.request(`/tg/${SHOP_BOT.id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Telegram-Bot-Api-Secret-Token": business?.webhook_secret ?? "",
                },
                body: JSON.stringify({
                    update_id: 1,
                    channel_post: {
                        message_id: 3000,
                        date: 1_795_000_000,
                        chat: { id: -1001, type: "channel" },
                        caption: "Yangi o'yinchoq keldi",
                    },
                }),
            })
            expect(posted.status).toBe(200)
            const post = counter.take()
            // Measured 42 read, 5 written: the shop's names for the guess (40 products here),
            // the post written once with its indexes (docs/capacity.md).
            expect(post.read).toBeLessThanOrEqual(60)
            expect(post.written).toBeLessThanOrEqual(8)
            const press = await owner("/api/owner/channel/history", { method: "POST" })
            expect(await press.json()).toEqual({ kind: "more", added: 10 })
            const batch = counter.take()
            // Measured 63 read, 51 written: one page of the past, the shop's names once, ten posts
            // written with their indexes, where it stopped.
            expect(batch.read).toBeLessThanOrEqual(80)
            expect(batch.written).toBeLessThanOrEqual(65)
        },
        SEED_TIMEOUT_MS,
    )
    it(
        "the support group: a customer's first message, the next one, the shop's answer",
        async () => {
            const { counter, client, customer } = await seed()
            const business = await env.DB.prepare(
                "SELECT id, webhook_secret FROM businesses",
            ).first<{ id: string; webhook_secret: string }>()
            await env.DB.prepare(
                `INSERT INTO support_groups (business_id, chat_id, title, connected_at)
                 VALUES (?, -1002, 'Savollar', 0)`,
            )
                .bind(business?.id)
                .run()
            let updateId = 1
            const update = (message: object): Promise<Response> =>
                client.request(`/tg/${SHOP_BOT.id}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Telegram-Bot-Api-Secret-Token": business?.webhook_secret ?? "",
                    },
                    body: JSON.stringify({ update_id: updateId++, message }),
                })
            const fromCustomer = {
                message_id: 50,
                from: CUSTOMER,
                chat: { id: CUSTOMER.id, type: "private" },
                text: "Salom, bormi?",
            }
            counter.take()
            expect((await update(fromCustomer)).status).toBe(200)
            const first = counter.take()
            // Measured 20 read, 3 written: the shop, the group, the topic (written once with its
            // name), and the pinned card of a customer with six months of history: the phone
            // given to this shop, their orders counted up to 11 (never the history), the last one.
            expect(first.read).toBeLessThanOrEqual(25)
            expect(first.written).toBeLessThanOrEqual(3)
            expect((await update({ ...fromCustomer, message_id: 51 })).status).toBe(200)
            const next = counter.take()
            // Measured 4: the shop, the group, the topic, and the one conditional UPDATE that
            // finds it waiting already (nothing written: its ❓ stays).
            expect(next.read).toBeLessThanOrEqual(5)
            expect(next.written).toBe(0)
            const threadId = client.telegram.topics[0]?.threadId
            const answer = await update({
                message_id: 52,
                from: { id: 4004, first_name: "Dilnoza" },
                chat: { id: -1002, type: "supergroup", is_forum: true },
                message_thread_id: threadId,
                is_topic_message: true,
                text: "Bor",
            })
            expect(answer.status).toBe(200)
            expect(client.telegram.copies.at(-1)?.toChatId).toBe(CUSTOMER.id)
            const reply = counter.take()
            // Measured 5 read, 1 written: the shop, the group, whose topic it is, and the topic
            // answered (its ✅): written once a turn of the talk, never per message.
            expect(reply.read).toBeLessThanOrEqual(6)
            expect(reply.written).toBe(1)
            // The storefront asks whether the shop answers messages: one row more (measured 3).
            await customer("/api/shop")
            expect(counter.take().read).toBeLessThanOrEqual(4)
        },
        SEED_TIMEOUT_MS,
    )
})
