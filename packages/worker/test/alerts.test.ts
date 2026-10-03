import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { ALERT_QUIET_MS, describeError, requestPlace } from "../src/alerts.js"
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
import type { Clock } from "@zumda/core"

describe("admin alerts", () => {
    let client: TestClient
    let slug: string
    let now: number
    const clock: Clock = { now: () => new Date(now) }

    const alerts = (): { html: string; token: string }[] =>
        client.telegram.sent.filter((m) => m.chatId === ADMIN.id && m.html.includes("🚨"))

    async function breakTheShop(): Promise<void> {
        // A token that no longer decrypts: every request to the shop fails with 500.
        await env.DB.prepare("UPDATE businesses SET bot_token_enc = 'broken'").run()
    }

    async function placeOrder(): Promise<Response> {
        const as = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        await as("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const created = await client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })(
            "/api/owner/products",
            {
                method: "POST",
                json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
            },
        )
        const { id } = (await created.json()) as { id: string }
        return as("/api/orders", {
            method: "POST",
            json: { items: [{ productId: id, quantity: 1 }], address: "Navoiy 12" },
        })
    }

    beforeEach(async () => {
        now = Date.now()
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT }, clock })
        slug = (await createActiveShop(client)).slug
    })

    it("a server error reaches the admins through the Zumda bot, once per quiet period", async () => {
        await breakTheShop()
        const as = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        expect((await as("/api/shop")).status).toBe(500)
        expect((await as("/api/shop")).status).toBe(500)

        expect(alerts()).toHaveLength(1)
        expect(alerts()[0]?.token).toBe(env.BUSINESS_BOT_TOKEN)
        // Where it broke, so the next one is found at once.
        expect(alerts()[0]?.html).toContain("GET /api/shop")

        now += ALERT_QUIET_MS
        await as("/api/shop")
        expect(alerts()).toHaveLength(2)
    })

    it("a failed notification alerts; a customer who blocked the bot does not", async () => {
        client.telegram.brokenChats.add(OWNER.id)
        expect((await placeOrder()).status).toBe(201)
        expect(alerts()).toHaveLength(1)
        expect(alerts()[0]?.html).toContain("Internal Server Error")

        now += ALERT_QUIET_MS
        client.telegram.brokenChats.clear()
        client.telegram.failReplies = true
        expect((await placeOrder()).status).toBe(201)
        client.telegram.failReplies = false
        expect(alerts()).toHaveLength(1)
    })

    it("names the request without its query or a shop bot's id", () => {
        expect(requestPlace("POST", "https://api.zumda.shop/tg/7351234567?x=1")).toBe(
            "POST /tg/<id>",
        )
        expect(requestPlace("GET", "https://api.zumda.shop/api/owner/money?period=week")).toBe(
            "GET /api/owner/money",
        )
    })

    it("never puts a bot token into the alert", () => {
        const leaked = new Error(`fetch https://api.telegram.org/bot${SHOP_BOT_TOKEN}/sendMessage`)
        expect(describeError(leaked)).not.toContain(SHOP_BOT_TOKEN)
        expect(describeError(leaked)).toContain("<token>")
        expect(describeError("x".repeat(1000))).toHaveLength(300)
    })
})
