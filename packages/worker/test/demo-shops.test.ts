import { env } from "cloudflare:workers"
import { DEMO_CARD, demoTemplate } from "@zumda/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    ADMIN,
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

/** The sample logo the Mini App serves: a PNG is enough for the check. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

interface ShopResult {
    shop: { id: string; demo: boolean; logoKey?: string; marketplace?: unknown }
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

async function count(sql: string, id: string): Promise<number> {
    const row = await env.DB.prepare(sql).bind(id).first<{ n: number }>()
    return row?.n ?? 0
}

describe("demo shops («Namuna»): made in «Platforma», never real", () => {
    let client: TestClient
    let shop: { id: string; slug: string }

    const admin = (): ReturnType<TestClient["as"]> => client.as(ADMIN, { businessBot: true })
    const customer = (): ReturnType<TestClient["as"]> =>
        client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: shop.slug })
    const makeDemo = (template = "food"): Promise<Response> =>
        admin()(`/api/admin/shops/${shop.id}/demo`, { method: "PUT", json: { template } })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        shop = await createActiveShop(client)
        // In the showcase and a district before: being a demo takes it out of both.
        await env.DB.prepare(
            `UPDATE businesses SET marketplace_commission_bps = 500, marketplace_joined_at = 1,
                district_id = NULL WHERE id = ?`,
        )
            .bind(shop.id)
            .run()
        vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
            Promise.resolve(
                String(input) === `${env.APP_ORIGIN}/demo/food.png`
                    ? new Response(PNG, { headers: { "Content-Type": "image/png" } })
                    : new Response("no", { status: 404 }),
            ),
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("«Namuna qilish» fills the shop: sample catalog, logo, test card, owner as courier", async () => {
        const response = await makeDemo()
        expect(response.status).toBe(200)
        const { shop: made } = await json<ShopResult>(response)
        expect(made).toMatchObject({ demo: true })
        expect(made.marketplace).toBeUndefined()
        expect(made.logoKey).toMatch(new RegExp(`^shops/${shop.id}/logo/`))
        expect(await env.BUCKET.get(made.logoKey ?? "")).not.toBeNull()

        const storefront = await json<{ demo: boolean; payoutCard?: { number: string } }>(
            await customer()("/api/shop"),
        )
        expect(storefront).toMatchObject({ demo: true, payoutCard: { number: DEMO_CARD.number } })
        expect(
            await count("SELECT COUNT(*) AS n FROM products WHERE business_id = ?", shop.id),
        ).toBe(demoTemplate("food").products.length)
        expect(
            await count(
                `SELECT COUNT(*) AS n FROM couriers
                 WHERE business_id = ? AND telegram_id = ${OWNER.id} AND status = 'active'`,
                shop.id,
            ),
        ).toBe(1)

        // Never in the showcase again: the list leaves it out, a new deal is refused.
        const showcase = await json<{ data: { id: string }[] }>(
            await client.as(CUSTOMER, {})("/api/showcase/shops"),
        )
        expect(showcase.data.map((s) => s.id)).not.toContain(shop.id)
        const deal = await admin()(`/api/admin/shops/${shop.id}/marketplace`, {
            method: "PUT",
            json: { percent: 5 },
        })
        expect(deal.status).toBe(422)
        expect(await json(deal)).toMatchObject({ error: { code: "DEMO_NOT_IN_SHOWCASE" } })
    })

    it("only an admin; only a sample of the shop's own kind", async () => {
        const owner = client.as(OWNER, { businessBot: true })
        expect(
            (
                await owner(`/api/admin/shops/${shop.id}/demo`, {
                    method: "PUT",
                    json: { template: "food" },
                })
            ).status,
        ).toBe(403)
        const wrong = await makeDemo("store")
        expect(wrong.status).toBe(422)
        expect(await json(wrong)).toMatchObject({ error: { code: "DEMO_TEMPLATE_MISMATCH" } })
        expect((await makeDemo("pizza")).status).toBe(400)
        const reset = await admin()(`/api/admin/shops/${shop.id}/demo/reset`, { method: "POST" })
        expect(reset.status).toBe(422)
        expect(await json(reset)).toMatchObject({ error: { code: "NOT_A_DEMO" } })
    })

    it("a demo order says so in every message; it never goes to the network", async () => {
        expect((await makeDemo()).status).toBe(200)
        await customer()("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const product = await env.DB.prepare(
            "SELECT id FROM products WHERE business_id = ? AND name = ?",
        )
            .bind(shop.id, "To'y oshi")
            .first<{ id: string }>()
        const placed = await customer()("/api/orders", {
            method: "POST",
            json: { items: [{ productId: product?.id, quantity: 1 }], address: "Navoiy 12" },
        })
        expect(placed.status).toBe(201)
        const order = await json<{ id: string; payment: { card?: { number: string } } }>(placed)
        expect(order.payment.card?.number).toBe(DEMO_CARD.number)

        const toOwner = client.telegram.sent.filter((m) => m.chatId === OWNER.id).at(-1)
        expect(toOwner?.html).toContain("Namuna buyurtma")
        const toCustomer = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toCustomer?.html).toContain("Namuna buyurtma")

        const network = await client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: shop.slug })(
            `/api/owner/orders/${order.id}/network`,
            { method: "PUT" },
        )
        expect(network.status).toBe(422)
        expect(await json(network)).toMatchObject({ error: { code: "NO_DISTRICT" } })

        // «Namunani tozalash»: the orders are gone, the sample's catalog is back.
        await env.DB.prepare("DELETE FROM products WHERE business_id = ? AND name = ?")
            .bind(shop.id, "Lag'mon")
            .run()
        const reset = await admin()(`/api/admin/shops/${shop.id}/demo/reset`, { method: "POST" })
        expect(reset.status).toBe(200)
        expect(await count("SELECT COUNT(*) AS n FROM orders WHERE business_id = ?", shop.id)).toBe(
            0,
        )
        expect(
            await count("SELECT COUNT(*) AS n FROM products WHERE business_id = ?", shop.id),
        ).toBe(demoTemplate("food").products.length)
    })
})
