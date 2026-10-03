import { applyD1Migrations } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { beforeEach } from "vitest"

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

/** Children first, because D1 enforces foreign keys. */
const TABLES = [
    "network_offers",
    "order_items",
    "cash_handovers",
    "orders",
    "courier_invites",
    "couriers",
    "courier_profiles",
    "customer_phone_shares",
    "alert_log",
    "customer_businesses",
    "customers",
    "products",
    "payout_cards",
    "businesses",
    "districts",
]

beforeEach(async () => {
    await env.DB.batch(TABLES.map((table) => env.DB.prepare(`DELETE FROM ${table}`)))
})
