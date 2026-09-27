import { applyD1Migrations } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { beforeEach } from "vitest"

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

/** Children first, because D1 enforces foreign keys. */
const TABLES = [
    "order_items",
    "orders",
    "courier_invites",
    "couriers",
    "customer_phone_shares",
    "customer_businesses",
    "customers",
    "products",
    "businesses",
]

beforeEach(async () => {
    await env.DB.batch(TABLES.map((table) => env.DB.prepare(`DELETE FROM ${table}`)))
})
