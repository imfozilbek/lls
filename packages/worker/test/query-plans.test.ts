/**
 * The free plan counts rows read: every query a screen repeats must walk an index range, never a
 * whole table or a shop's (or a courier's) whole history. EXPLAIN QUERY PLAN on the real schema.
 */
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { SHOWCASE_SHOPS } from "../src/repositories/business.repository.js"
import {
    ACTIVE_VERSION_SQL,
    BY_STATUS,
    CASH_OPEN_FROM,
    CASH_OPEN_WHERE,
    OPEN_PAYMENTS_FROM,
    OPEN_PAYMENTS_WHERE,
    RECEIPT_REUSE_SQL,
    TRANSFER_REJECTIONS_SQL,
    COURIER_ORDERS_SQL,
    networkWaitingSql,
    pageSql,
    shopStatusWhere,
} from "../src/repositories/order.repository.js"
import {
    NAMES_OF,
    SHOWCASE_BY_WORD_FROM,
    WORD_FILTER,
} from "../src/repositories/product.repository.js"
import {
    OPEN_TRIPS_OF_BUSINESS_SQL,
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

const ACTIVE = ["pending", "accepted", "preparing", "ready", "picked_up"]
const FINAL = ["delivered", "cancelled"]

describe("query plans", () => {
    it("the showcase's shops check one catalog entry each, never the products' rows", async () => {
        const plan = (await planOf(SHOWCASE_SHOPS, ["active"])).join("\n")
        expect(plan).toContain("USING COVERING INDEX idx_products_catalog")
        expect(plan).not.toMatch(/SCAN products\b/)
    })

    it("a shop's product names for a list: the catalog index alone, no product row", async () => {
        const plan = await planOf(NAMES_OF, ["biz-1"])
        expect(plan.join("\n")).toContain("USING COVERING INDEX idx_products_catalog")
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
})
