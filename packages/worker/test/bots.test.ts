import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    ADMIN,
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"

async function webhookSecret(): Promise<string> {
    const row = await env.DB.prepare("SELECT webhook_secret FROM businesses").first<{
        webhook_secret: string
    }>()
    return row?.webhook_secret ?? ""
}

function update(body: object, secret: string): RequestInit {
    return {
        method: "POST",
        headers: { "Content-Type": "application/json", [SECRET_HEADER]: secret },
        body: JSON.stringify(body),
    }
}

describe("platform bot", () => {
    let client: TestClient

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("rejects updates without the webhook secret", async () => {
        const response = await client.request("/tg/platform", update({}, "wrong"))
        expect(response.status).toBe(401)
    })

    it("the owner hears back in the language of their Telegram", async () => {
        const russian = { ...OWNER, language_code: "ru" }
        await client.as(russian, {})("/api/platform/shops", {
            method: "POST",
            json: { botToken: SHOP_BOT_TOKEN, name: "Osh", type: "food", deliveryFee: 0 },
        })
        const toOwner = client.telegram.sent.find((m) => m.chatId === OWNER.id)
        expect(toOwner?.html).toContain("Заявка")
    })

    it("/start offers to connect a shop through the Mini App", async () => {
        const response = await client.request(
            "/tg/platform",
            update(
                { message: { from: OWNER, chat: { id: OWNER.id }, text: "/start" } },
                env.PLATFORM_WEBHOOK_SECRET,
            ),
        )
        expect(response.status).toBe(200)
        const [welcome] = client.telegram.sent
        expect(welcome?.chatId).toBe(OWNER.id)
        expect(welcome?.options?.keyboard?.inline_keyboard[1]?.[0]?.web_app?.url).toBe(
            "https://lls-app.pages.dev/?mode=onboarding",
        )
    })

    it("registration notifies the owner and admins; admin approval connects the shop bot", async () => {
        const registered = await client.as(OWNER, {})("/api/platform/shops", {
            method: "POST",
            json: { botToken: SHOP_BOT_TOKEN, name: "Osh <Markaz>", type: "food", deliveryFee: 0 },
        })
        const shop = (await registered.json()) as { id: string }
        const [toOwner, toAdmin] = client.telegram.sent
        expect(toOwner?.chatId).toBe(OWNER.id)
        expect(toOwner?.html).toContain("Osh &lt;Markaz&gt;")
        expect(toAdmin?.chatId).toBe(ADMIN.id)
        // The admin sees the owner's name and the kind of shop in words, not raw values.
        expect(toAdmin?.html).toContain(">Rustam</a>")
        expect(toAdmin?.html).toMatch(/\((ovqat|еда)\)/)
        const approve = toAdmin?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data
        expect(approve).toBe(`r:${shop.id}:approve`)

        const fromStranger = await client.request(
            "/tg/platform",
            update(
                { callback_query: { id: "cb-1", from: STRANGER, data: approve } },
                env.PLATFORM_WEBHOOK_SECRET,
            ),
        )
        expect(fromStranger.status).toBe(200)
        expect(client.telegram.webhooks).toHaveLength(0)

        await client.request(
            "/tg/platform",
            update(
                {
                    callback_query: {
                        id: "cb-2",
                        from: ADMIN,
                        data: approve,
                        message: { message_id: 5, chat: { id: ADMIN.id } },
                    },
                },
                env.PLATFORM_WEBHOOK_SECRET,
            ),
        )
        expect(client.telegram.webhooks).toEqual([
            {
                token: SHOP_BOT_TOKEN,
                url: `http://localhost/tg/${SHOP_BOT.id}`,
                secret: await webhookSecret(),
            },
        ])
        expect(client.telegram.menuButtons[0]?.url).toBe(
            "https://lls-app.pages.dev/?shop=osh-markaz",
        )
        const link = client.telegram.sent.at(-1)
        expect(link?.chatId).toBe(OWNER.id)
        expect(link?.html).toContain("https://t.me/osh_markaz_bot")
        const status = await env.DB.prepare("SELECT status FROM businesses").first<{
            status: string
        }>()
        expect(status?.status).toBe("active")
    })
})

describe("platform bot: a failed connection on approval", () => {
    let client: TestClient

    const platform = (body: object): Promise<Response> =>
        client.request("/tg/platform", update(body, env.PLATFORM_WEBHOOK_SECRET))

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("tells the admin, and /reconnect connects the bot later", async () => {
        const registered = await client.as(OWNER, {})("/api/platform/shops", {
            method: "POST",
            json: { botToken: SHOP_BOT_TOKEN, name: "Osh Markaz", type: "food", deliveryFee: 0 },
        })
        const shop = (await registered.json()) as { id: string; slug: string }

        client.telegram.failWebhooks = true
        await platform({
            callback_query: { id: "cb-1", from: ADMIN, data: `r:${shop.id}:approve` },
        })
        const warning = client.telegram.sent.at(-1)
        expect(warning?.chatId).toBe(ADMIN.id)
        expect(warning?.html).toContain(`/reconnect ${shop.slug}`)

        // Pressing Approve again cannot help (the shop is active); the command can.
        client.telegram.failWebhooks = false
        await platform({
            message: { from: STRANGER, chat: { id: STRANGER.id }, text: `/reconnect ${shop.slug}` },
        })
        expect(client.telegram.webhooks).toHaveLength(0)

        await platform({
            message: { from: ADMIN, chat: { id: ADMIN.id }, text: `/reconnect ${shop.slug}` },
        })
        expect(client.telegram.webhooks).toHaveLength(1)
        expect(client.telegram.menuButtons[0]?.url).toContain(`shop=${shop.slug}`)
        expect(
            client.telegram.sent.some((m) => m.chatId === OWNER.id && m.html.includes("t.me/")),
        ).toBe(true)
        expect(client.telegram.sent.at(-1)?.chatId).toBe(ADMIN.id)
    })
})

describe("shop bot", () => {
    let client: TestClient
    let slug: string

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        client.telegram.sent.length = 0
    })

    async function shopUpdate(body: object, secret?: string): Promise<Response> {
        return client.request(`/tg/${SHOP_BOT.id}`, update(body, secret ?? (await webhookSecret())))
    }

    async function placeOrder(): Promise<{ id: string; number: number }> {
        const owner = client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const product = await owner("/api/owner/products", {
            method: "POST",
            json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
        })
        const { id: productId } = (await product.json()) as { id: string }
        await shopUpdate({
            message: {
                from: CUSTOMER,
                chat: { id: CUSTOMER.id },
                contact: { phone_number: "998901234567", user_id: CUSTOMER.id },
            },
        })
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const response = await customer("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 2 }], address: "Navoiy 12", landmark: "Maktab" },
        })
        expect(response.status).toBe(201)
        return (await response.json()) as { id: string; number: number }
    }

    it("rejects a wrong secret and unknown bots", async () => {
        expect((await shopUpdate({}, "wrong")).status).toBe(401)
        expect((await client.request("/tg/123", update({}, "x"))).status).toBe(404)
    })

    it("/start opens this shop's menu", async () => {
        await shopUpdate({ message: { from: CUSTOMER, chat: { id: CUSTOMER.id }, text: "/start" } })
        const [welcome] = client.telegram.sent
        expect(welcome?.token).toBe(SHOP_BOT_TOKEN)
        expect(welcome?.html).toContain("Osh Markaz")
        expect(welcome?.html).toContain("Здравствуйте")
        expect(welcome?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            `https://lls-app.pages.dev/?shop=${slug}`,
        )
    })

    it("saves the sender's own contact and ignores forwarded contacts", async () => {
        await shopUpdate({
            message: {
                from: STRANGER,
                chat: { id: STRANGER.id },
                contact: { phone_number: "998901234567", user_id: CUSTOMER.id },
            },
        })
        const forwarded = await env.DB.prepare("SELECT phone FROM customers WHERE telegram_id = ?")
            .bind(CUSTOMER.id)
            .first()
        expect(forwarded).toBeNull()

        await shopUpdate({
            message: {
                from: CUSTOMER,
                chat: { id: CUSTOMER.id },
                contact: { phone_number: "998901234567", user_id: CUSTOMER.id },
            },
        })
        const row = await env.DB.prepare("SELECT phone FROM customers WHERE telegram_id = ?")
            .bind(CUSTOMER.id)
            .first<{ phone: string }>()
        expect(row?.phone).toBe("+998901234567")
        expect(client.telegram.sent.at(-1)?.html).toContain("номер")
    })

    it("answers 200 even when the reply to the user fails, so Telegram does not resend", async () => {
        client.telegram.failReplies = true
        const response = await shopUpdate({
            message: {
                from: CUSTOMER,
                chat: { id: CUSTOMER.id },
                contact: { phone_number: "998901234567", user_id: CUSTOMER.id },
            },
        })
        expect(response.status).toBe(200)
        const row = await env.DB.prepare("SELECT phone FROM customers WHERE telegram_id = ?")
            .bind(CUSTOMER.id)
            .first<{ phone: string }>()
        expect(row?.phone).toBe("+998901234567")

        const start = await shopUpdate({
            message: { from: CUSTOMER, chat: { id: CUSTOMER.id }, text: "/start" },
        })
        expect(start.status).toBe(200)
    })

    it("new order → owner card with buttons; accept → card edited, customer told", async () => {
        const order = await placeOrder()
        const card = client.telegram.sent.at(-1)
        expect(card?.chatId).toBe(OWNER.id)
        expect(card?.html).toContain(`#${order.number}`)
        expect(card?.html).toContain("Maktab")
        expect(card?.html).toContain("+998 90 123 45 67")
        expect(card?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data).toBe(
            `a:${order.id}:accepted`,
        )

        await shopUpdate({
            callback_query: { id: "cb-1", from: OWNER, data: `a:${order.id}:accepted` },
        })
        expect(client.telegram.answered).toContain("cb-1")
        const edited = client.telegram.edited.at(-1)
        expect(edited?.messageId).toBeGreaterThan(0)
        expect(edited?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data).toBe(
            `a:${order.id}:preparing`,
        )
        const toCustomer = client.telegram.sent.at(-1)
        expect(toCustomer?.chatId).toBe(CUSTOMER.id)
        expect(toCustomer?.html).toContain(`#${order.number}`)

        // A stale button does not move the order again
        await shopUpdate({
            callback_query: { id: "cb-2", from: OWNER, data: `a:${order.id}:accepted` },
        })
        const row = await env.DB.prepare("SELECT status FROM orders").first<{ status: string }>()
        expect(row?.status).toBe("accepted")
    })

    it("a failed answer to the button still updates the order and the owner card", async () => {
        const order = await placeOrder()
        client.telegram.failReplies = true
        const response = await shopUpdate({
            callback_query: { id: "cb-1", from: OWNER, data: `a:${order.id}:accepted` },
        })
        expect(response.status).toBe(200)
        const row = await env.DB.prepare("SELECT status FROM orders").first<{ status: string }>()
        expect(row?.status).toBe("accepted")
        expect(client.telegram.edited.at(-1)?.options?.keyboard?.inline_keyboard[0]?.[0]).toEqual(
            expect.objectContaining({ callback_data: `a:${order.id}:preparing` }),
        )
    })

    it("buttons pressed by someone else change nothing", async () => {
        const order = await placeOrder()
        await shopUpdate({
            callback_query: { id: "cb-1", from: STRANGER, data: `a:${order.id}:accepted` },
        })
        await shopUpdate({ callback_query: { id: "cb-2", from: STRANGER, data: `x:${order.id}` } })
        const row = await env.DB.prepare("SELECT status FROM orders").first<{ status: string }>()
        expect(row?.status).toBe("pending")
        expect(client.telegram.answered).toEqual(["cb-1", "cb-2"])
    })

    it("owner cancels from the chat; customer cancel notifies the owner", async () => {
        const first = await placeOrder()
        await shopUpdate({ callback_query: { id: "cb-1", from: OWNER, data: `x:${first.id}` } })
        const row = await env.DB.prepare("SELECT status, cancelled_by FROM orders WHERE id = ?")
            .bind(first.id)
            .first<{ status: string; cancelled_by: string }>()
        expect(row).toEqual({ status: "cancelled", cancelled_by: "owner" })
        expect(client.telegram.edited.at(-1)?.options?.keyboard?.inline_keyboard).toEqual([])

        const second = await placeOrder()
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        await customer(`/api/orders/${second.id}`, {
            method: "PATCH",
            json: { status: "cancelled" },
        })
        const note = client.telegram.sent.at(-1)
        expect(note?.chatId).toBe(OWNER.id)
        expect(note?.html).toContain(`#${second.number}`)
    })
})
