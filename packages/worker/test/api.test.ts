import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OTHER_BOT_TOKEN,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    sharePhoneWithShops,
    testClient,
    TEST_CARD,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

interface Json {
    [key: string]: unknown
}

const ascii = (text: string): Uint8Array => new TextEncoder().encode(text)

async function json<T = Json>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("auth", () => {
    it("rejects requests without initData", async () => {
        const client = testClient()
        const response = await client.request("/api/me")
        expect(response.status).toBe(401)
        expect(await json(response)).toEqual({
            error: { code: "UNAUTHORIZED", message: "Open the app from Telegram" },
        })
    })

    it("health needs no auth", async () => {
        expect((await testClient().request("/health")).status).toBe(200)
    })

    it("CORS allows only the app origin", async () => {
        const client = testClient()
        const allowed = await client.request("/api/me", {
            method: "OPTIONS",
            headers: {
                Origin: "https://lls-app.pages.dev",
                "Access-Control-Request-Method": "GET",
            },
        })
        expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://lls-app.pages.dev")
        const denied = await client.request("/api/me", {
            method: "OPTIONS",
            headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
        })
        expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull()
    })
})

describe("onboarding through the platform bot", () => {
    it("registers a pending shop and never stores the token in plain text", async () => {
        const client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const owner = client.as(OWNER, {})
        const response = await owner("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh Markaz",
                type: "food",
                deliveryFee: 10_000,
                payoutCard: TEST_CARD,
            },
        })
        expect(response.status).toBe(201)
        const shop = await json(response)
        expect(shop).toMatchObject({
            slug: "osh-markaz",
            status: "pending",
            botUsername: "osh_markaz_bot",
        })
        expect(JSON.stringify(shop)).not.toContain(SHOP_BOT_TOKEN)

        const row = await env.DB.prepare("SELECT bot_token_enc FROM businesses").first<{
            bot_token_enc: string
        }>()
        expect(row?.bot_token_enc).not.toContain("777000")

        const mine = await json<Json[]>(await owner("/api/platform/shops"))
        expect(mine).toHaveLength(1)
    })

    it("rejects a token Telegram does not accept", async () => {
        const client = testClient()
        const response = await client.as(OWNER, {})("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: OTHER_BOT_TOKEN,
                name: "X",
                type: "food",
                deliveryFee: 0,
                payoutCard: TEST_CARD,
            },
        })
        expect(response.status).toBe(400)
        expect(await json(response)).toMatchObject({ error: { code: "INVALID_BOT_TOKEN" } })
    })

    it("validates the body", async () => {
        const client = testClient()
        const response = await client.as(OWNER, {})("/api/platform/shops", {
            method: "POST",
            json: { botToken: "nope", name: "", type: "cars", deliveryFee: -1 },
        })
        expect(response.status).toBe(400)
        const body = await json<{ error: { code: string; details: { field: string }[] } }>(response)
        expect(body.error.code).toBe("VALIDATION_ERROR")
        expect(body.error.details.map((d) => d.field)).toEqual(
            expect.arrayContaining(["botToken", "name", "type", "deliveryFee", "payoutCard"]),
        )
    })
})

describe("inside a shop", () => {
    let client: TestClient
    let slug: string

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
    })

    function asOwner(): ReturnType<TestClient["as"]> {
        return client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
    }

    function asCustomer(user: object = CUSTOMER): ReturnType<TestClient["as"]> {
        return client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
    }

    async function addProduct(name: string, price: number): Promise<string> {
        const response = await asOwner()("/api/owner/products", {
            method: "POST",
            json: { name, price, unit: "portion", category: "meals" },
        })
        expect(response.status).toBe(201)
        return (await json<{ id: string }>(response)).id
    }

    async function givePhone(): Promise<void> {
        await asCustomer()("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
    }

    it("initData from another bot is rejected for this shop", async () => {
        const wrongBot = client.as(CUSTOMER, { botToken: OTHER_BOT_TOKEN, shop: slug })
        expect((await wrongBot("/api/shop")).status).toBe(401)
        const platformData = client.as(CUSTOMER, { shop: slug })
        expect((await platformData("/api/shop")).status).toBe(401)
        const unknownShop = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: "nope" })
        expect((await unknownShop("/api/shop")).status).toBe(404)
    })

    it("customer sees the shop and only available products", async () => {
        await addProduct("Osh", 35_000)
        const hidden = await addProduct("Somsa", 8_000)
        await asOwner()(`/api/owner/products/${hidden}`, {
            method: "PATCH",
            json: { isAvailable: false },
        })

        const shop = await json(await asCustomer()("/api/shop"))
        expect(shop).toMatchObject({
            slug,
            name: "Osh Markaz",
            isOpen: true,
            brandColor: "#0ea5e9",
        })
        expect(shop).not.toHaveProperty("ownerTelegramId")
        expect(shop).toMatchObject({ viewerRole: "customer" })
        expect(await json(await asOwner()("/api/shop"))).toMatchObject({ viewerRole: "owner" })

        const products = await json<{ data: { name: string }[]; meta: Json }>(
            await asCustomer()("/api/shop/products"),
        )
        expect(products.data.map((p) => p.name)).toEqual(["Osh"])
        expect(products.meta).toEqual({ page: 1, limit: 20, total: 1 })

        const all = await json<{ meta: { total: number } }>(await asOwner()("/api/owner/products"))
        expect(all.meta.total).toBe(2)
    })

    it("owner routes are closed to customers", async () => {
        const customer = asCustomer()
        expect((await customer("/api/owner/shop")).status).toBe(403)
        expect((await customer("/api/owner/orders")).status).toBe(403)
        expect(
            (
                await customer("/api/owner/products", {
                    method: "POST",
                    json: { name: "X", price: 1, unit: "pcs", category: "other" },
                })
            ).status,
        ).toBe(403)
    })

    it("platform routes are closed inside a shop", async () => {
        expect((await asOwner()("/api/platform/shops")).status).toBe(400)
    })

    it("customer profile: name from Telegram, language switch", async () => {
        const me = await json(await asCustomer()("/api/me"))
        expect(me).toMatchObject({ name: "Aziz Karimov", language: "ru" })
        const updated = await json(
            await asCustomer()("/api/me", { method: "PATCH", json: { language: "uz" } }),
        )
        expect(updated).toMatchObject({ language: "uz" })
    })

    it("order flow: server prices, numbering, statuses, access control", async () => {
        const osh = await addProduct("Osh", 35_000)
        await givePhone()

        const placed = await asCustomer()("/api/orders", {
            method: "POST",
            json: {
                items: [{ productId: osh, quantity: 2, unitPrice: 1 }],
                address: "Navoiy 12",
                landmark: "Maktab yonida",
                location: { latitude: 41.31, longitude: 69.28 },
            },
        })
        expect(placed.status).toBe(201)
        const order = await json<{ id: string; number: number; total: number; status: string }>(
            placed,
        )
        expect(order).toMatchObject({ number: 1, total: 80_000, status: "pending" })

        const second = await json<{ number: number }>(
            await asCustomer()("/api/orders", {
                method: "POST",
                json: { items: [{ productId: osh, quantity: 1 }], address: "Navoiy 12" },
            }),
        )
        expect(second.number).toBe(2)

        const mine = await json<{ meta: { total: number } }>(await asCustomer()("/api/orders"))
        expect(mine.meta.total).toBe(2)

        const stranger = asCustomer(STRANGER)
        expect((await stranger(`/api/orders/${order.id}`)).status).toBe(403)

        // The shop starts only after the transfer arrived.
        const unpaid = await asOwner()(`/api/owner/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "accepted" },
        })
        expect(unpaid.status).toBe(422)
        expect(await json(unpaid)).toMatchObject({ error: { code: "PAYMENT_REQUIRED" } })
        const accepted = await asOwner()(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        expect(await json(accepted)).toMatchObject({ status: "accepted", nextStatus: "preparing" })

        const skip = await asOwner()(`/api/owner/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "delivered" },
        })
        expect(skip.status).toBe(409)

        const lateCancel = await asCustomer()(`/api/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "cancelled" },
        })
        expect(lateCancel.status).toBe(422)
        expect(await json(lateCancel)).toMatchObject({
            error: { code: "ORDER_CANNOT_BE_CANCELLED" },
        })

        const ownerCancel = await asOwner()(`/api/owner/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "cancelled", reason: "Tugadi" },
        })
        expect(await json(ownerCancel)).toMatchObject({ status: "cancelled", cancelledBy: "owner" })

        const active = await json<{ meta: { total: number } }>(
            await asOwner()("/api/owner/orders?filter=active"),
        )
        expect(active.meta.total).toBe(1)

        const money = await json<{ totals: Json }>(await asOwner()("/api/owner/money"))
        expect(money.totals).toMatchObject({ placed: 1, cancelled: 1 })
    })

    it("an order of one shop cannot be read or changed through another shop", async () => {
        const osh = await addProduct("Osh", 35_000)
        await givePhone()
        const placed = await json<{ id: string }>(
            await asCustomer()("/api/orders", {
                method: "POST",
                json: { items: [{ productId: osh, quantity: 1 }], address: "Navoiy 12" },
            }),
        )
        // A second shop of the same owner (same bot token for simplicity).
        await env.DB.prepare(
            `INSERT INTO businesses SELECT 'shop-b', 'other-shop', name, type, owner_telegram_id,
                status, 999, 'other_shop_bot', bot_token_enc, webhook_secret, brand_color,
                logo_key, address, latitude, longitude, delivery_fee, free_delivery_from,
                min_order, delivery_radius_m, working_hours, features, accepting_orders,
                bottle_deposit, marketplace_commission_bps, marketplace_joined_at,
                created_at, updated_at, payout_card_number, payout_card_holder, district_id,
                network_delivery
             FROM businesses WHERE slug = ?`,
        )
            .bind(slug)
            .run()
        const sentBefore = client.telegram.sent.length
        const viaOther = { botToken: SHOP_BOT_TOKEN, shop: "other-shop" }

        const read = await client.as(CUSTOMER, viaOther)(`/api/orders/${placed.id}`)
        expect(read.status).toBe(404)
        const cancel = await client.as(CUSTOMER, viaOther)(`/api/orders/${placed.id}`, {
            method: "PATCH",
            json: { status: "cancelled" },
        })
        expect(cancel.status).toBe(404)
        const advance = await client.as(OWNER, viaOther)(`/api/owner/orders/${placed.id}`, {
            method: "PATCH",
            json: { status: "accepted" },
        })
        expect(advance.status).toBe(404)
        expect(client.telegram.sent.length).toBe(sentBefore)
    })

    it("ordering needs a phone; errors carry the rule code", async () => {
        const osh = await addProduct("Osh", 35_000)
        const response = await asCustomer()("/api/orders", {
            method: "POST",
            json: { items: [{ productId: osh, quantity: 1 }], address: "Navoiy 12" },
        })
        expect(response.status).toBe(422)
        expect(await json(response)).toMatchObject({ error: { code: "PHONE_REQUIRED" } })
    })

    it("owner updates shop settings", async () => {
        const response = await asOwner()("/api/owner/shop", {
            method: "PATCH",
            json: {
                name: "Osh Markaz №1",
                brandColor: "#F97316",
                delivery: { fee: 5_000, minOrder: 30_000 },
                workingHours: { mon: { open: "10:00", close: "22:00" } },
                acceptingOrders: false,
            },
        })
        expect(response.status).toBe(200)
        expect(await json(response)).toMatchObject({
            name: "Osh Markaz №1",
            brandColor: "#f97316",
            delivery: { fee: 5_000, minOrder: 30_000 },
            acceptingOrders: false,
            isOpen: false,
        })
        const owner = await json(await asOwner()("/api/owner/shop"))
        expect(owner).toMatchObject({ status: "active", ownerTelegramId: OWNER.id })
    })

    it("images: upload, serve with cache headers, replace and delete", async () => {
        const osh = await addProduct("Osh", 35_000)
        // A real WebP header: "RIFF", size, "WEBP".
        const bytes = new Uint8Array([...ascii("RIFF"), 4, 0, 0, 0, ...ascii("WEBP"), 1, 2])
        const uploaded = await asOwner()(`/api/owner/products/${osh}/image`, {
            method: "PUT",
            headers: { "Content-Type": "image/webp" },
            body: bytes,
        })
        expect(uploaded.status).toBe(200)
        const { imageKey } = await json<{ imageKey: string }>(uploaded)
        expect(imageKey).toMatch(/^shops\/.+\/products\/.+\.webp$/)

        const served = await client.request(`/img/${imageKey}`)
        expect(served.status).toBe(200)
        expect(served.headers.get("Cache-Control")).toContain("immutable")
        expect(served.headers.get("X-Content-Type-Options")).toBe("nosniff")
        expect(served.headers.get("Access-Control-Allow-Origin")).toBe("*")
        expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes)

        const wrongType = await asOwner()(`/api/owner/products/${osh}/image`, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: bytes,
        })
        expect(wrongType.status).toBe(415)

        // An HTML page named image/webp is refused by its first bytes.
        const disguised = await asOwner()(`/api/owner/products/${osh}/image`, {
            method: "PUT",
            headers: { "Content-Type": "image/webp" },
            body: ascii("<html><script>alert(1)</script>"),
        })
        expect(disguised.status).toBe(415)

        const huge = await asOwner()(`/api/owner/products/${osh}/image`, {
            method: "PUT",
            headers: { "Content-Type": "image/webp" },
            body: new Uint8Array(1_600_000),
        })
        expect(huge.status).toBe(413)

        const removed = await asOwner()(`/api/owner/products/${osh}/image`, { method: "DELETE" })
        expect(await json(removed)).not.toHaveProperty("imageKey")
        expect(await env.BUCKET.get(imageKey)).toBeNull()

        expect((await client.request("/img/secrets/../x")).status).toBe(404)
    })

    it("deleting a product returns 204", async () => {
        const osh = await addProduct("Osh", 35_000)
        const response = await asOwner()(`/api/owner/products/${osh}`, { method: "DELETE" })
        expect(response.status).toBe(204)
        expect((await asOwner()(`/api/owner/products/${osh}`, { method: "DELETE" })).status).toBe(
            404,
        )
    })

    it("unknown routes return the standard error body", async () => {
        const response = await asOwner()("/api/nope")
        expect(response.status).toBe(404)
        expect(await json(response)).toMatchObject({ error: { code: "NOT_FOUND" } })
    })
})
