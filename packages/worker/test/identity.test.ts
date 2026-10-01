import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OTHER_BOT_TOKEN,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"
import type { BotInfo } from "../src/telegram/gateway.js"

/** Owns the second shop and holds its bot token, so can sign initData for anyone there. */
const ATTACKER = { id: 6006, first_name: "Mallory" }
const ATTACKER_BOT: BotInfo = { id: 888000, username: "mallory_shop_bot", firstName: "M" }
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"

interface Json {
    [key: string]: unknown
}

async function json<T = Json>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("a shop owner cannot borrow other shops' customers", () => {
    let client: TestClient
    let shopA: string
    let shopB: { id: string; slug: string }

    /** Anyone holding shop B's bot token can sign this for any user id. */
    const forgedInB = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: OTHER_BOT_TOKEN, shop: shopB.slug })

    async function registerShopB(): Promise<{ id: string; slug: string }> {
        const response = await client.as(ATTACKER, {})("/api/platform/shops", {
            method: "POST",
            json: { botToken: OTHER_BOT_TOKEN, name: "Mallory", type: "food", deliveryFee: 0 },
        })
        return json<{ id: string; slug: string }>(response)
    }

    /** The customer really sends their phone to shop A's bot. */
    async function shareContactWithShopA(): Promise<void> {
        const row = await env.DB.prepare("SELECT webhook_secret FROM businesses WHERE bot_id = ?")
            .bind(SHOP_BOT.id)
            .first<{ webhook_secret: string }>()
        const response = await client.request(`/tg/${SHOP_BOT.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [SECRET_HEADER]: row?.webhook_secret ?? "",
            },
            body: JSON.stringify({
                message: {
                    from: CUSTOMER,
                    chat: { id: CUSTOMER.id },
                    contact: { phone_number: "+998901234567", user_id: CUSTOMER.id },
                },
            }),
        })
        expect(response.status).toBe(200)
    }

    beforeEach(async () => {
        client = testClient({
            bots: { [SHOP_BOT_TOKEN]: SHOP_BOT, [OTHER_BOT_TOKEN]: ATTACKER_BOT },
        })
        shopA = (await createActiveShop(client)).slug
        shopB = await registerShopB()
        await shareContactWithShopA()
    })

    it("a pending shop opens only for its owner", async () => {
        expect((await forgedInB(CUSTOMER)("/api/me")).status).toBe(404)
        expect((await forgedInB(ATTACKER)("/api/shop")).status).toBe(200)
    })

    it("a forged identity in another shop sees no phone and cannot order with it", async () => {
        await env.DB.prepare("UPDATE businesses SET status = 'active' WHERE id = ?")
            .bind(shopB.id)
            .run()
        // The real shop sees the phone the customer sent to its bot.
        const inA = await json(
            await client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: shopA })("/api/me"),
        )
        expect(inA).toMatchObject({ phone: "+998901234567" })

        // Shop B's owner signs the same user id with their own bot token.
        const me = await json<{ phone?: string; name: string }>(
            await forgedInB({ ...CUSTOMER, first_name: "Hacked" })("/api/me"),
        )
        expect(me.phone).toBeUndefined()
        expect(me.name).toBe("Aziz Karimov")

        const product = await json<{ id: string }>(
            await client.as(ATTACKER, { botToken: OTHER_BOT_TOKEN, shop: shopB.slug })(
                "/api/owner/products",
                {
                    method: "POST",
                    json: { name: "Bait", price: 1_000, unit: "pcs", category: "other" },
                },
            ),
        )
        const order = await forgedInB(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId: product.id, quantity: 1 }], address: "x" },
        })
        expect(order.status).toBe(422)
        expect(await json(order)).toMatchObject({ error: { code: "PHONE_REQUIRED" } })
    })

    it("a disabled shop is closed to everyone, its owner too", async () => {
        await env.DB.prepare("UPDATE businesses SET status = 'disabled' WHERE id = ?")
            .bind(shopB.id)
            .run()
        expect((await forgedInB(ATTACKER)("/api/shop")).status).toBe(404)
        expect((await forgedInB(CUSTOMER)("/api/shop")).status).toBe(404)
        expect(
            (await client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: shopA })("/api/shop")).status,
        ).toBe(200)
    })
})

describe("the first visit", () => {
    it("several first requests at once register the person once, without errors", async () => {
        const client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const { slug } = await createActiveShop(client)
        const newcomer = { id: 7007, first_name: "Kamola", language_code: "uz" }
        const as = client.as(newcomer, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const responses = await Promise.all([as("/api/me"), as("/api/me"), as("/api/me")])
        expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
        const ids = await Promise.all(responses.map((r) => json<{ id: string }>(r)))
        expect(new Set(ids.map((c) => c.id)).size).toBe(1)
        const rows = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM customers WHERE telegram_id = ?",
        )
            .bind(newcomer.id)
            .first<{ n: number }>()
        expect(rows?.n).toBe(1)
    })
})
