/**
 * The shop's bot may not write to an owner who never pressed Start in it (a bot made with
 * «Bot yaratish»): the owner still hears everything, through Zumda | Business, with the note to
 * press Start; once they do, the shop's bot writes again.
 */
import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

describe("the shop's bot cannot write to its owner", () => {
    let client: TestClient
    let slug: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })

    async function ownerChat(): Promise<string> {
        const shop = (await (await as(OWNER)("/api/owner/shop")).json()) as { ownerChat: string }
        return shop.ownerChat
    }

    async function pressStart(): Promise<void> {
        const row = await env.DB.prepare("SELECT webhook_secret FROM businesses").first<{
            webhook_secret: string
        }>()
        const response = await client.request(`/tg/${SHOP_BOT.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [SECRET_HEADER]: row?.webhook_secret ?? "",
            },
            body: JSON.stringify({
                update_id: 1,
                message: {
                    message_id: 1,
                    from: OWNER,
                    chat: { id: OWNER.id, type: "private" },
                    date: 0,
                    text: "/start owner",
                },
            }),
        })
        expect(response.status).toBe(200)
    }

    const poster = (): Promise<Response> =>
        as(OWNER)("/api/owner/shop/poster", {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: PNG,
        })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        client.telegram.notStarted.add(`${SHOP_BOT_TOKEN}:${OWNER.id}`)
    })

    it("the poster comes through Zumda | Business with the note, and after Start from the shop's bot", async () => {
        expect(await ownerChat()).toBe("unknown")

        const first = await poster()
        expect(first.status).toBe(200)
        expect(((await first.json()) as { delivered: string }).delivered).toBe("business")
        const viaBusiness = client.telegram.documents.at(-1)
        expect(viaBusiness?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(viaBusiness?.chatId).toBe(OWNER.id)
        expect(viaBusiness?.caption).toContain("@osh_markaz_bot sizga yoza olmadi")
        expect(viaBusiness?.caption).toContain("QR-kod")
        const buttons = viaBusiness?.options?.keyboard?.inline_keyboard.flat() ?? []
        expect(buttons[0]?.url).toBe("https://t.me/osh_markaz_bot?start=owner")
        // Links only: an action button pressed here would reach the wrong bot.
        expect(buttons.some((b) => b.callback_data !== undefined)).toBe(false)
        expect(await ownerChat()).toBe("closed")

        client.telegram.notStarted.clear()
        await pressStart()
        const thanks = client.telegram.sent.at(-1)
        expect(thanks?.token).toBe(SHOP_BOT_TOKEN)
        expect(thanks?.html).toContain("endi buyurtmalar va xabarlar shu yerga keladi")
        expect(await ownerChat()).toBe("open")

        const second = await poster()
        expect(((await second.json()) as { delivered: string }).delivered).toBe("shop")
        expect(client.telegram.documents.at(-1)?.token).toBe(SHOP_BOT_TOKEN)
    })

    it("a new order reaches the owner through Zumda | Business without action buttons", async () => {
        const product = await as(OWNER)("/api/owner/products", {
            method: "POST",
            json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
        })
        const { id: productId } = (await product.json()) as { id: string }
        await as(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        client.telegram.sent.length = 0
        const order = await as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 1 }], address: "Navoiy 12" },
        })
        expect(order.status).toBe(201)
        const toOwner = client.telegram.sent.filter((m) => m.chatId === OWNER.id)
        expect(toOwner.length).toBeGreaterThan(0)
        for (const message of toOwner) {
            expect(message.token).toBe(env.BUSINESS_BOT_TOKEN)
            expect(message.html).toContain("sizga yoza olmadi")
            const keys = message.options?.keyboard?.inline_keyboard.flat() ?? []
            expect(keys.some((b) => b.callback_data !== undefined)).toBe(false)
        }
        expect(toOwner.some((m) => m.html.includes("Yangi buyurtma"))).toBe(true)
        // The customer still hears from the shop's own bot.
        expect(
            client.telegram.sent.some(
                (m) => m.chatId === CUSTOMER.id && m.token === SHOP_BOT_TOKEN,
            ),
        ).toBe(true)
    })

    it("bot-check asks Telegram quietly and keeps the answer", async () => {
        const check = async (): Promise<string> => {
            const response = await as(OWNER)("/api/owner/shop/bot-check", { method: "POST" })
            expect(response.status).toBe(200)
            return ((await response.json()) as { ownerChat: string }).ownerChat
        }
        expect(await check()).toBe("closed")
        expect(await ownerChat()).toBe("closed")
        client.telegram.notStarted.clear()
        expect(await check()).toBe("open")
        expect(client.telegram.typing.at(-1)).toEqual({ token: SHOP_BOT_TOKEN, chatId: OWNER.id })
        expect(await ownerChat()).toBe("open")
        expect((await as(CUSTOMER)("/api/owner/shop/bot-check", { method: "POST" })).status).toBe(
            403,
        )
    })

    it("when Zumda | Business is blocked too, the poster is still kept for the download", async () => {
        client.telegram.notStarted.add(`${env.BUSINESS_BOT_TOKEN}:${OWNER.id}`)
        const response = await poster()
        expect(response.status).toBe(200)
        const body = (await response.json()) as { delivered: string; key: string }
        expect(body.delivered).toBe("none")
        expect((await client.request(`/img/${body.key}`)).status).toBe(200)
    })
})
