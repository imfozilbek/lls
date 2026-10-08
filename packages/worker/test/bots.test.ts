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
    TEST_CARD,
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

describe("Zumda Business bot", () => {
    let client: TestClient

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("rejects updates without the webhook secret", async () => {
        const response = await client.request("/tg/business", update({}, "wrong"))
        expect(response.status).toBe(401)
    })

    it("the owner hears back in Uzbek, whatever language their Telegram uses", async () => {
        const russian = { ...OWNER, language_code: "ru" }
        await client.as(russian, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh",
                type: "food",
                deliveryFee: 0,
                payoutCard: TEST_CARD,
            },
        })
        const toOwner = client.telegram.sent.find((m) => m.chatId === OWNER.id)
        expect(toOwner?.html).toContain("arizasi qabul qilindi")
    })

    it("/start opens «Mening bizneslarim» in the Mini App", async () => {
        const response = await client.request(
            "/tg/business",
            update(
                { message: { from: OWNER, chat: { id: OWNER.id }, text: "/start" } },
                env.BUSINESS_WEBHOOK_SECRET,
            ),
        )
        expect(response.status).toBe(200)
        // The greeting is the owner's instruction video, the button under it.
        const [welcome] = client.telegram.videos
        expect(welcome?.chatId).toBe(OWNER.id)
        expect(welcome?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(welcome?.video.url).toMatch(/\/welcome\/biznes\.mp4$/)
        expect(welcome?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            "https://business.zumda.test/?mode=business",
        )
    })

    it("registration notifies the owner and admins; admin approval connects the shop bot", async () => {
        const registered = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh <Markaz>",
                type: "food",
                deliveryFee: 0,
                payoutCard: TEST_CARD,
            },
        })
        const shop = (await registered.json()) as { id: string }
        const [toOwner, toAdmin] = client.telegram.sent
        expect(toOwner?.chatId).toBe(OWNER.id)
        expect(toOwner?.html).toContain("Osh &lt;Markaz&gt;")
        expect(toAdmin?.chatId).toBe(ADMIN.id)
        // The admin sees the owner's name and the kind of shop in words, not raw values.
        expect(toAdmin?.html).toContain(">Rustam</a>")
        expect(toAdmin?.html).toContain("(restoran)")
        const approve = toAdmin?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data
        expect(approve).toBe(`r:${shop.id}:approve`)

        // The application already connected the bot («Tez orada ochiladi»); count from here.
        expect(client.telegram.webhooks).toHaveLength(1)
        expect(client.telegram.descriptions).toHaveLength(1)
        client.telegram.webhooks.splice(0)
        client.telegram.menuButtons.splice(0)
        client.telegram.descriptions.splice(0)

        const fromStranger = await client.request(
            "/tg/business",
            update(
                { callback_query: { id: "cb-1", from: STRANGER, data: approve } },
                env.BUSINESS_WEBHOOK_SECRET,
            ),
        )
        expect(fromStranger.status).toBe(200)
        expect(client.telegram.webhooks).toHaveLength(0)

        await client.request(
            "/tg/business",
            update(
                {
                    callback_query: {
                        id: "cb-2",
                        from: ADMIN,
                        data: approve,
                        message: { message_id: 5, chat: { id: ADMIN.id } },
                    },
                },
                env.BUSINESS_WEBHOOK_SECRET,
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
            "https://zumda-app.pages.dev/?shop=osh-markaz",
        )
        const link = client.telegram.sent.at(-1)
        expect(link?.chatId).toBe(OWNER.id)
        expect(link?.html).toContain("https://t.me/osh_markaz_bot")
        const status = await env.DB.prepare("SELECT status FROM businesses").first<{
            status: string
        }>()
        expect(status?.status).toBe("active")
        // Zumda writes the bot's description: the shop's name and «Zumda asosida ishlaydi».
        expect(client.telegram.descriptions).toEqual([
            expect.objectContaining({
                token: SHOP_BOT_TOKEN,
                shortDescription: "Osh <Markaz>: uyga buyurtma bering. Zumda asosida ishlaydi",
            }),
        ])
    })
})

describe("Zumda Business bot: an old application card", () => {
    it("decides nothing once the shop was decided: a live shop stays live", async () => {
        const client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const shop = await createActiveShop(client)
        await client.request(
            "/tg/business",
            update(
                { callback_query: { id: "old-card", from: ADMIN, data: `r:${shop.id}:reject` } },
                env.BUSINESS_WEBHOOK_SECRET,
            ),
        )
        const status = await env.DB.prepare("SELECT status FROM businesses WHERE id = ?")
            .bind(shop.id)
            .first<{ status: string }>()
        expect(status?.status).toBe("active")
        // The admin reads the shop's status now, in Uzbek, never an English error.
        expect(client.telegram.answerTexts.at(-1)).toBe("✅ Tasdiqlandi")
    })
})

describe("a turned-off shop's bot", () => {
    it("says it does not work now, with no button to an app that would answer 404", async () => {
        const client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const shop = await createActiveShop(client)
        await env.DB.prepare("UPDATE businesses SET status = 'disabled' WHERE id = ?")
            .bind(shop.id)
            .run()
        await client.request(
            `/tg/${SHOP_BOT.id}`,
            update(
                {
                    message: {
                        message_id: 1,
                        chat: { id: CUSTOMER.id },
                        from: CUSTOMER,
                        text: "/start",
                    },
                },
                await webhookSecret(),
            ),
        )
        const reply = client.telegram.sent.at(-1)
        expect(reply?.chatId).toBe(CUSTOMER.id)
        expect(reply?.html).toContain("ishlamayapti")
        expect(reply?.options?.keyboard).toBeUndefined()
    })
})

describe("Zumda Business bot: a failed connection on approval", () => {
    let client: TestClient

    const platform = (body: object): Promise<Response> =>
        client.request("/tg/business", update(body, env.BUSINESS_WEBHOOK_SECRET))

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("tells the admin, and «Botni qayta ulash» in «Platforma» connects the bot later", async () => {
        const registered = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh Markaz",
                type: "food",
                deliveryFee: 0,
                payoutCard: TEST_CARD,
            },
        })
        const shop = (await registered.json()) as { id: string; slug: string }
        // The application already connected the bot («Tez orada ochiladi»); count from here.
        expect(client.telegram.webhooks).toHaveLength(1)
        client.telegram.webhooks.splice(0)
        client.telegram.menuButtons.splice(0)

        client.telegram.failWebhooks = true
        await platform({
            callback_query: { id: "cb-1", from: ADMIN, data: `r:${shop.id}:approve` },
        })
        const warning = client.telegram.sent.at(-1)
        expect(warning?.chatId).toBe(ADMIN.id)
        expect(warning?.html).toContain("Botni qayta ulash")
        expect(warning?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            `https://business.zumda.test/?mode=business&admin=shop_${shop.id}`,
        )

        // The command is gone: the bot points to the app and changes nothing.
        client.telegram.failWebhooks = false
        await platform({
            message: { from: ADMIN, chat: { id: ADMIN.id }, text: `/reconnect ${shop.slug}` },
        })
        expect(client.telegram.webhooks).toHaveLength(0)
        expect(client.telegram.sent.at(-1)?.html).toContain("ilovada")

        const reconnect = (user: object): Promise<Response> =>
            client.as(user, { businessBot: true })(`/api/admin/shops/${shop.id}/reconnect`, {
                method: "POST",
            })
        expect((await reconnect(STRANGER)).status).toBe(403)
        expect((await reconnect(OWNER)).status).toBe(403)
        expect(client.telegram.webhooks).toHaveLength(0)

        const done = await reconnect(ADMIN)
        expect(done.status).toBe(200)
        expect(((await done.json()) as { bot: object }).bot).toEqual({ connected: true })
        expect(client.telegram.webhooks).toHaveLength(1)
        expect(client.telegram.menuButtons[0]?.url).toContain(`shop=${shop.slug}`)
        expect(
            client.telegram.sent.some((m) => m.chatId === OWNER.id && m.html.includes("t.me/")),
        ).toBe(true)
    })
})

describe("the Zumda bot is for customers only", () => {
    let client: TestClient

    const zumdaShop = (body: object): Promise<Response> =>
        client.request("/tg/platform", update(body, env.PLATFORM_WEBHOOK_SECRET))

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("rejects updates without its webhook secret", async () => {
        const response = await client.request("/tg/platform", update({}, "wrong"))
        expect(response.status).toBe(401)
    })

    it("a command does nothing: the bot points to the showcase", async () => {
        const { slug } = await createActiveShop(client)
        await zumdaShop({
            message: { from: ADMIN, chat: { id: ADMIN.id }, text: `/market ${slug} 5` },
        })
        const reply = client.telegram.sent.at(-1)
        expect(reply?.html).toContain("ilovada")
        expect(reply?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
            "mode=market",
        )
        const row = await env.DB.prepare(
            "SELECT marketplace_commission_bps AS bps FROM businesses WHERE slug = ?",
        )
            .bind(slug)
            .first<{ bps: number | null }>()
        expect(row?.bps).toBeNull()
    })

    it("an approval card it sent before Zumda Business still works", async () => {
        const registered = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh Markaz",
                type: "food",
                deliveryFee: 0,
                payoutCard: TEST_CARD,
            },
        })
        const shop = (await registered.json()) as { id: string }
        await zumdaShop({
            callback_query: { id: "cb-old", from: ADMIN, data: `r:${shop.id}:approve` },
        })
        // Once at the application, once at the approval.
        expect(client.telegram.webhooks).toHaveLength(2)
        expect(client.telegram.answered).toContain("cb-old")
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
        expect(welcome?.html).toContain("Assalomu alaykum")
        expect(welcome?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            `https://zumda-app.pages.dev/?shop=${slug}`,
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
        expect(client.telegram.sent.at(-1)?.html).toContain("raqamingiz saqlandi")
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

    it("new order → card «ждём перевод», the customer gets the card; «Деньги пришли, принять»", async () => {
        const order = await placeOrder()
        const card = client.telegram.sent.find((m) => m.chatId === OWNER.id)
        expect(card?.html).toContain(`#${order.number}`)
        expect(card?.html).toContain("Maktab")
        expect(card?.html).toContain("+998 90 123 45 67")
        expect(card?.html).toContain("o'tkazma kutilmoqda")
        expect(card?.options?.keyboard?.inline_keyboard[0]?.[0]).toEqual({
            text: "💳 Pul keldi, qabul qilish",
            callback_data: `p:${order.id}`,
        })
        const toPay = client.telegram.sent.at(-1)
        expect(toPay?.chatId).toBe(CUSTOMER.id)
        expect(toPay?.html).toContain("4111 1111 1111 1111")
        expect(toPay?.html).toContain("Rustam Karimov")

        // Accepting before the money arrived is refused: the order stays new.
        await shopUpdate({
            callback_query: { id: "cb-0", from: OWNER, data: `a:${order.id}:accepted` },
        })
        expect(client.telegram.answered).toContain("cb-0")
        const still = await env.DB.prepare("SELECT status FROM orders").first<{ status: string }>()
        expect(still?.status).toBe("pending")

        // «Pul keldi» asks first: the sum and the card to check in the bank app.
        await shopUpdate({ callback_query: { id: "cb-q", from: OWNER, data: `p:${order.id}` } })
        const question = client.telegram.sent.at(-1)
        expect(question?.chatId).toBe(OWNER.id)
        expect(question?.html).toContain("keldimi")
        expect(question?.html).toContain("•••• 1111")
        expect(question?.html).toContain("o'tkazganini hali bildirmagan")
        expect(question?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data).toBe(
            `pc:${order.id}`,
        )
        const asked = await env.DB.prepare("SELECT status FROM orders").first<{ status: string }>()
        expect(asked?.status).toBe("pending")

        await shopUpdate({ callback_query: { id: "cb-1", from: OWNER, data: `pc:${order.id}` } })
        expect(client.telegram.answered).toContain("cb-1")
        const edited = client.telegram.edited.at(-1)
        expect(edited?.messageId).toBeGreaterThan(0)
        expect(edited?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data).toBe(
            `a:${order.id}:preparing`,
        )
        expect(edited?.html).toContain("O'tkazma bilan to'langan")
        const toCustomer = client.telegram.sent.at(-1)
        expect(toCustomer?.chatId).toBe(CUSTOMER.id)
        expect(toCustomer?.html).toContain(`#${order.number}`)
        expect(toCustomer?.html).toContain("To'lov keldi")
        // The customer's message opens this order in the shop's app.
        expect(toCustomer?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            `https://zumda-app.pages.dev/?shop=${slug}&order=${order.id}`,
        )
        // The owner's card: the next step, cancel, then the order in the app.
        expect(edited?.options?.keyboard?.inline_keyboard.at(-1)?.[0]?.web_app?.url).toBe(
            `https://zumda-app.pages.dev/?shop=${slug}&order=${order.id}`,
        )

        // A stale button does not move the order again
        await shopUpdate({ callback_query: { id: "cb-2", from: OWNER, data: `pc:${order.id}` } })
        const row = await env.DB.prepare("SELECT status, payment_status FROM orders").first()
        expect(row).toEqual({ status: "accepted", payment_status: "paid" })
    })

    it("«Yo'q, kelmadi» under the screenshot: unpaid again, the customer sends it again", async () => {
        const order = await placeOrder()
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const sent = await customer(`/api/orders/${order.id}/transfer-sent`, {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]),
        })
        expect(sent.status).toBe(200)
        // Asked now, the owner also gets «Yo'q, kelmadi».
        await shopUpdate({ callback_query: { id: "cb-q", from: OWNER, data: `p:${order.id}` } })
        const question = client.telegram.sent.at(-1)
        expect(question?.html).not.toContain("o'tkazganini hali bildirmagan")
        expect(
            question?.options?.keyboard?.inline_keyboard.flat().map((b) => b.callback_data),
        ).toContain(`pn:${order.id}`)

        await shopUpdate({ callback_query: { id: "cb-n", from: OWNER, data: `pn:${order.id}` } })
        expect(client.telegram.answered).toContain("cb-n")
        const row = await env.DB.prepare(
            "SELECT status, payment_status, transfer_rejections FROM orders",
        ).first()
        expect(row).toEqual({ status: "pending", payment_status: "unpaid", transfer_rejections: 1 })
        const toCustomer = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toCustomer?.html).toContain("pulni topmadi")
        // Pressed again: nothing changes.
        await shopUpdate({ callback_query: { id: "cb-n2", from: OWNER, data: `pn:${order.id}` } })
        const again = await env.DB.prepare("SELECT transfer_rejections FROM orders").first()
        expect(again).toEqual({ transfer_rejections: 1 })
    })

    it("a failed answer to the button still updates the order and the owner card", async () => {
        const order = await placeOrder()
        client.telegram.failReplies = true
        const response = await shopUpdate({
            callback_query: { id: "cb-1", from: OWNER, data: `pc:${order.id}` },
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
        const before = client.telegram.sent.length
        await shopUpdate({ callback_query: { id: "cb-1", from: STRANGER, data: `pc:${order.id}` } })
        await shopUpdate({ callback_query: { id: "cb-2", from: STRANGER, data: `x:${order.id}` } })
        await shopUpdate({ callback_query: { id: "cb-3", from: STRANGER, data: `p:${order.id}` } })
        await shopUpdate({ callback_query: { id: "cb-4", from: STRANGER, data: `pn:${order.id}` } })
        const row = await env.DB.prepare("SELECT status FROM orders").first<{ status: string }>()
        expect(row?.status).toBe("pending")
        expect(client.telegram.answered).toEqual(["cb-1", "cb-2", "cb-3", "cb-4"])
        // The stranger is never shown the sum and the card.
        expect(client.telegram.sent.length).toBe(before)
    })

    it("owner cancels from the chat; customer cancel notifies the owner", async () => {
        const first = await placeOrder()
        await shopUpdate({ callback_query: { id: "cb-1", from: OWNER, data: `x:${first.id}` } })
        const row = await env.DB.prepare("SELECT status, cancelled_by FROM orders WHERE id = ?")
            .bind(first.id)
            .first<{ status: string; cancelled_by: string }>()
        expect(row).toEqual({ status: "cancelled", cancelled_by: "owner" })
        // A finished order keeps only the way into the app.
        expect(client.telegram.edited.at(-1)?.options?.keyboard?.inline_keyboard.flat()).toEqual([
            {
                text: "📱 Buyurtmani ochish",
                web_app: { url: `https://zumda-app.pages.dev/?shop=${slug}&order=${first.id}` },
            },
        ])

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
