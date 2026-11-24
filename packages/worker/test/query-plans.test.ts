/**
 * The free plan counts rows read: every query a screen repeats must walk an index range, never a
 * whole table or a shop's (or a courier's) whole history. EXPLAIN QUERY PLAN on the real schema.
 */
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { SHOWCASE_SHOPS } from "../src/repositories/business.repository.js"
import { freeNetworkCouriersSql } from "../src/repositories/courier.repository.js"
import { countSql, nextSql } from "../src/repositories/guide.repository.js"
import {
    ACTIVE_VERSION_SQL,
    BY_STATUS,
    CASH_OPEN_FROM,
    CASH_OPEN_WHERE,
    LINE_REMOVED_SQL,
    LINK_ORDER_SQL,
    LINK_SALE_SQL,
    OPEN_PAYMENTS_FROM,
    OPEN_PAYMENTS_WHERE,
    REFUND_OWED_FROM,
    REFUND_OWED_WHERE,
    RECEIPT_REUSE_SQL,
    STOCK_RETURN_SQL,
    STOCK_TAKE_SQL,
    TRANSFER_REJECTIONS_SQL,
    COURIER_ORDERS_SQL,
    networkWaitingSql,
    pageSql,
    shopStatusWhere,
} from "../src/repositories/order.repository.js"
import { COUNT_SQL, NEXT_SQL } from "../src/repositories/phone-ask.repository.js"
import {
    CATALOG_NAMES,
    NAMES_OF,
    PHOTOS_OF,
    SHOWCASE_ALL_FROM,
    SHOWCASE_BY_WORD_FROM,
    WORD_FILTER,
    inCategory,
    inCategoryBinds,
} from "../src/repositories/product.repository.js"
import {
    CHANNEL_SQL,
    LAST_VISIT_SQL,
    LINK_BY_ID_SQL,
    LIVE_ADS_COUNT_SQL,
    LIVE_CHANNEL_POSTS_SQL,
    LIVE_LINKS_SQL,
    POST_LINK_SQL,
    PRODUCT_POSTS_SQL,
    VISIT_OPENS_SQL,
    knownPostsSql,
} from "../src/repositories/source-link.repository.js"
import {
    SUPPORT_GROUP_SQL,
    THREAD_BY_CUSTOMER_SQL,
    THREAD_BY_TOPIC_SQL,
} from "../src/repositories/support.repository.js"
import {
    OPEN_TRIPS_OF_BUSINESS_SQL,
    WITH_TRIP_SQL,
    insertTripSql,
    openTripsOfCouriersSql,
} from "../src/repositories/trip.repository.js"

async function planOf(sql: string, binds: unknown[]): Promise<string[]> {
    const { results } = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .bind(...binds)
        .all<{ detail: string }>()
    return results.map((row) => row.detail)
}

/** Every table read is a SEARCH by an index; `orders` and `trips` are never scanned. */
function expectIndexed(plan: string[], indexes: readonly string[]): void {
    const text = plan.join("\n")
    for (const index of indexes) {
        expect(text).toContain(`USING INDEX ${index}`)
    }
    expect(text).not.toMatch(/SCAN (orders|trips)\b/)
}

/** The primary keys' own indexes (`id TEXT PRIMARY KEY`). */
const ORDERS_KEY = "sqlite_autoindex_orders_1"
const TRIPS_KEY = "sqlite_autoindex_trips_1"

const ACTIVE = ["pending", "accepted", "preparing", "ready", "picked_up"]
const FINAL = ["delivered", "cancelled"]

describe("query plans", () => {
    it("«Qo'llanma» goes through the people once: who had the guide and a customer's last shop by key", async () => {
        for (const audience of ["owner", "courier", "customer"] as const) {
            for (const [sql, binds] of [
                [nextSql(audience), [audience, 20]],
                [countSql(audience), [audience]],
            ] as const) {
                const plan = await planOf(sql, [...binds])
                expect(plan.join("\n")).toContain(
                    "SEARCH g USING COVERING INDEX sqlite_autoindex_guide_sends_1 (audience=? AND telegram_id=?)",
                )
                expect(plan.join("\n")).not.toMatch(/\b(orders|order_items)\b/)
                if (audience === "customer") {
                    expectIndexed(plan, ["sqlite_autoindex_customer_businesses_1"])
                }
            }
        }
    })

    it("«Raqam so'rash» walks the live shops, their couriers and people by key, never orders", async () => {
        for (const [sql, binds] of [
            [NEXT_SQL, [0, 10]],
            [COUNT_SQL, [0]],
        ] as const) {
            const plan = await planOf(sql, [...binds])
            const text = plan.join("\n")
            expectIndexed(plan, ["idx_businesses_status_created", "idx_couriers_business_status"])
            expect(text).toContain("SEARCH a USING INDEX sqlite_autoindex_phone_asks_1")
            expect(text).toMatch(
                /SEARCH c USING INDEX sqlite_autoindex_customers_\d \(telegram_id=\?\)/,
            )
            // `courier_profiles.telegram_id` is its primary key.
            expect(text).toContain("SEARCH cp USING INTEGER PRIMARY KEY")
            expect(text).not.toMatch(/\b(orders|order_items)\b/)
        }
    })

    it("free network couriers: each person's own links by index, never a scan of orders", async () => {
        const binds = [Date.now(), "active", "district-1"]
        for (const [sql, all] of [
            [freeNetworkCouriersSql(false), [...binds, 20]],
            [freeNetworkCouriersSql(true), [...binds, "biz-1", "removed", "pending", 20]],
        ] as const) {
            const plan = await planOf(sql, [...all])
            expectIndexed(plan, ["idx_couriers_telegram"])
        }
    })

    it("the showcase's shops check one catalog entry each, never the products' rows", async () => {
        const plan = (await planOf(SHOWCASE_SHOPS, ["active"])).join("\n")
        expect(plan).toContain("USING COVERING INDEX idx_products_catalog")
        expect(plan).not.toMatch(/SCAN products\b/)
    })

    it("an order takes and a cancel gives back stock: one product by its key", async () => {
        const take = (await planOf(STOCK_TAKE_SQL, [1, "p-1", "biz-1"])).join("\n")
        expect(take).toMatch(/SEARCH products USING INDEX sqlite_autoindex_products_1 \(id=\?\)/)
        const back = await planOf(STOCK_RETURN_SQL, [1, "p-1", "biz-1", "o-1", 1])
        expectIndexed(back, ["sqlite_autoindex_products_1", ORDERS_KEY])
    })

    it("a demo's photos before it starts again: the shop's products by the catalog index", async () => {
        const plan = (await planOf(PHOTOS_OF, ["biz-1"])).join("\n")
        expect(plan).toContain("USING INDEX idx_products_catalog (business_id=?)")
        expect(plan).not.toMatch(/SCAN products\b/)
    })

    it("a shop's product names for a list: the catalog index alone, no product row", async () => {
        const plan = await planOf(NAMES_OF, ["biz-1"])
        expect(plan.join("\n")).toContain("USING COVERING INDEX idx_products_catalog")
    })

    it("a shop's ids and names for a channel post: the shop's products by the catalog index", async () => {
        const plan = (await planOf(CATALOG_NAMES, ["biz-1"])).join("\n")
        expect(plan).toContain("USING INDEX idx_products_catalog (business_id=?)")
        expect(plan).not.toMatch(/SCAN products\b/)
    })

    it("a courier's orders: open ones and today's finished ones, two index ranges", async () => {
        const plan = await planOf(COURIER_ORDERS_SQL, [
            "courier-1",
            ...ACTIVE,
            "courier-1",
            ...FINAL,
            0,
            50,
        ])
        expectIndexed(plan, ["idx_orders_courier"])
        expect(plan.join("\n")).toContain("updated_at>?")
    })

    it("open trips come from active orders, never from every trip ever made", async () => {
        expectIndexed(await planOf(OPEN_TRIPS_OF_BUSINESS_SQL, ["shop-1", ...ACTIVE]), [
            "idx_orders_business_status",
        ])
        expectIndexed(await planOf(openTripsOfCouriersSql(2), ["c-1", "c-2", ...ACTIVE]), [
            "idx_orders_courier",
        ])
    })

    it("a trip is written only over its stops' versions, each looked up by its key", async () => {
        const trip = ["t-1", "shop-1", "c-1", null, null, null, 1, 1]
        const insert = await planOf(insertTripSql(2), ["o-1", 1, "o-2", 2, ...trip, 2])
        expectIndexed(insert, [ORDERS_KEY])
        expectIndexed(await planOf(insertTripSql(0), [...trip, 0]), [])
        const stop = await planOf(
            `UPDATE orders SET trip_id = ?, updated_at = ? WHERE id = ? AND updated_at = ?
                AND ${WITH_TRIP_SQL}`,
            ["t-1", 2, "o-1", 1, "t-1"],
        )
        expectIndexed(stop, [ORDERS_KEY])
        expect(stop.join("\n")).toContain(`SEARCH trips USING COVERING INDEX ${TRIPS_KEY}`)
    })

    it("network orders waiting: only the open ones, by the partial index", async () => {
        for (const unalerted of [false, true]) {
            const plan = await planOf(networkWaitingSql(2, unalerted), ["d-1", "d-2", 30])
            expectIndexed(plan, ["idx_orders_network_open", "idx_businesses_district"])
        }
    })

    it("the owner's polled version and an «active» page read only open orders", async () => {
        expectIndexed(await planOf(ACTIVE_VERSION_SQL, ["shop-1", ...ACTIVE]), [
            "idx_orders_business_status",
        ])
        const plan = await planOf(pageSql(BY_STATUS, shopStatusWhere(ACTIVE.length)), [
            "shop-1",
            ...ACTIVE,
            21,
            0,
        ])
        expectIndexed(plan, ["idx_orders_business_status (business_id=? AND status=?)"])
    })

    it("a category, main or further: a shop's catalog index range, never all products", async () => {
        const inShop = await planOf(
            `SELECT id FROM products WHERE business_id = ? AND is_available = 1
             AND ${inCategory()} ORDER BY position, name`,
            ["biz-1", ...inCategoryBinds("books")],
        )
        expect(inShop.join("\n")).toContain("USING INDEX idx_products_catalog")
        expect(inShop.join("\n")).not.toMatch(/SCAN products\b/)
        const showcase = await planOf(
            `SELECT p.id ${SHOWCASE_ALL_FROM} WHERE b.status = ?
             AND b.marketplace_commission_bps IS NOT NULL AND p.is_available = 1
             AND ${inCategory("p.")} ORDER BY p.name`,
            ["active", ...inCategoryBinds("books")],
        )
        const text = showcase.join("\n")
        expect(text).toContain("USING INDEX idx_products_catalog")
        expect(text).not.toMatch(/SCAN (p|products)\b/)
    })

    it("a showcase search reads only the products whose words match", async () => {
        const plan = await planOf(
            `SELECT p.id ${SHOWCASE_BY_WORD_FROM} WHERE b.status = ? AND ${WORD_FILTER}`,
            ["osh", "osh~", "active", "lag", "lag~"],
        )
        const text = plan.join("\n")
        expect(text).toContain("SEARCH product_words USING PRIMARY KEY (word>? AND word<?)")
        expect(text).toMatch(/SEARCH p USING INDEX sqlite_autoindex_products_1 \(id=\?\)/)
        expect(text).not.toMatch(/SCAN (p|products|b|businesses)\b/)
    })

    it("«Pul» lists only the open transfers and the cash couriers hold", async () => {
        const list = (from: string, where: string): string =>
            `SELECT id FROM ${from} WHERE ${where} ORDER BY number ASC LIMIT 20`
        expectIndexed(await planOf(list(OPEN_PAYMENTS_FROM, OPEN_PAYMENTS_WHERE), ["shop-1"]), [
            "idx_orders_business_payment (business_id=? AND payment_status=?)",
        ])
        expectIndexed(await planOf(list(CASH_OPEN_FROM, CASH_OPEN_WHERE), ["shop-1"]), [
            "idx_orders_cash_open (business_id=?)",
        ])
        // The part owed for lines the shop did not have («Yo'q»): its partial index.
        expectIndexed(await planOf(list(REFUND_OWED_FROM, REFUND_OWED_WHERE), ["shop-1"]), [
            "idx_orders_refund_owed (business_id=?)",
        ])
    })

    it("«Yo'q» marks one line by its key, only after this very save", async () => {
        const plan = await planOf(LINE_REMOVED_SQL, [1, "o-1", 1, "o-1", 1])
        expectIndexed(plan, ["sqlite_autoindex_order_items_1 (order_id=? AND line=?)"])
    })

    it("a reused screenshot is found by its hash; the demo shops are a few rows", async () => {
        const plan = await planOf(RECEIPT_REUSE_SQL, ["hash", "order-1", "shop-1", "customer-1"])
        expectIndexed(plan, ["idx_orders_receipt_hash (receipt_hash=?)"])
    })

    it("a new screenshot reads only the customer's refused transfers", async () => {
        expectIndexed(await planOf(TRANSFER_REJECTIONS_SQL, ["customer-1", "order-1"]), [
            "idx_orders_customer_rejected (customer_id=?)",
        ])
    })

    describe("the shop's support group", () => {
        it("the group, a customer's topic and an answer's customer by their keys", async () => {
            expectIndexed(await planOf(SUPPORT_GROUP_SQL, ["biz-1"]), [
                "sqlite_autoindex_support_groups_1 (business_id=?)",
            ])
            const topic = await planOf(THREAD_BY_CUSTOMER_SQL, [-100, 2002])
            expect(topic.join("\n")).toMatch(
                /SEARCH support_threads USING PRIMARY KEY \(chat_id=\? AND customer_telegram_id=\?\)/,
            )
            expectIndexed(await planOf(THREAD_BY_TOPIC_SQL, [-100, 7]), [
                "idx_support_threads_thread (chat_id=? AND thread_id=?)",
            ])
        })
    })

    describe("the shop's channel and its links", () => {
        const LINKS_KEY = "sqlite_autoindex_source_links_1"
        /** No list ever walks every link of the platform. */
        const noScan = (plan: string[]): void =>
            expect(plan.join("\n")).not.toMatch(/SCAN (source_links|source_visits|shop_channels)\b/)

        it("the channel and a link by their keys", async () => {
            const channel = await planOf(CHANNEL_SQL, ["biz-1"])
            expectIndexed(channel, ["sqlite_autoindex_shop_channels_1 (business_id=?)"])
            expectIndexed(await planOf(LINK_BY_ID_SQL, ["code", "biz-1"]), [`${LINKS_KEY} (id=?)`])
        })

        it("a page of live posts or ad links, newest first, by the live index", async () => {
            const ads = await planOf(LIVE_LINKS_SQL, ["biz-1", "ad", 21, 0])
            expectIndexed(ads, ["idx_source_links_live (business_id=? AND kind=?)"])
            expect(ads.join("\n")).not.toContain("TEMP B-TREE")
            const posts = await planOf(LIVE_CHANNEL_POSTS_SQL, ["biz-1", "post", -100, 21, 0])
            expectIndexed(posts, ["idx_source_links_live (business_id=? AND kind=?)"])
            noScan(ads)
            noScan(posts)
            const count = await planOf(LIVE_ADS_COUNT_SQL, ["biz-1", 50])
            expectIndexed(count, ["idx_source_links_live (business_id=? AND kind=?)"])
            noScan(count)
        })

        it("a product's live posts, by the posts index", async () => {
            const plan = await planOf(PRODUCT_POSTS_SQL, ["biz-1", "p-1", -100, 20])
            expectIndexed(plan, ["idx_source_links_product_posts (business_id=? AND product_id=?)"])
            expect(plan.join("\n")).not.toContain("TEMP B-TREE")
            noScan(plan)
        })

        it("the channel's posts Zumda knows: the post index, one key each", async () => {
            const plan = await planOf(knownPostsSql(3), [-100, 1, 2, 3])
            // Only the index: the posts' numbers are all it needs.
            expect(plan.join("\n")).toContain(
                "USING COVERING INDEX idx_source_links_post (chat_id=? AND message_id=?)",
            )
            noScan(plan)
            const one = await planOf(POST_LINK_SQL, [-100, 1])
            expectIndexed(one, ["idx_source_links_post (chat_id=? AND message_id=?)"])
            noScan(one)
        })

        it("a visit: the person's last link by its key, and the opens by the link's key", async () => {
            const opens = await planOf(VISIT_OPENS_SQL, ["code", "biz-1", "biz-1", 7, "code"])
            expectIndexed(opens, [`${LINKS_KEY} (id=?)`])
            noScan(opens)
            const last = await planOf(LAST_VISIT_SQL, ["biz-1", 7, 0])
            noScan(last)
            expect(last.join("\n")).toMatch(/SEARCH source_visits USING PRIMARY KEY/)
        })

        it("an order and a sale count for their link by its key", async () => {
            expectIndexed(await planOf(LINK_ORDER_SQL, ["code", "biz-1"]), [`${LINKS_KEY} (id=?)`])
            const sale = await planOf(LINK_SALE_SQL, [1, "code", "biz-1", "o-1", 1])
            expectIndexed(sale, [`${LINKS_KEY} (id=?)`, ORDERS_KEY])
        })
    })
})
