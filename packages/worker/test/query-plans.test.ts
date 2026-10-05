/**
 * The free plan counts rows read: every query a screen repeats must walk an index range, never a
 * whole table or a shop's (or a courier's) whole history. EXPLAIN QUERY PLAN on the real schema.
 */
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { COURIER_ORDERS_SQL, networkWaitingSql } from "../src/repositories/order.repository.js"
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
})
