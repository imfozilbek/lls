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
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"

interface Json {
    [key: string]: unknown
}

async function json<T = Json>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("Zumda showcase", () => {
    let client: TestClient
    let slug: string
    let shopId: string

    const inShop = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
    /** The shop's storefront opened from the showcase, inside the Zumda bot. */
    const viaShowcase = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { shop: slug, via: "marketplace" })
    const viaPlatform = (user: object): ReturnType<TestClient["as"]> => client.as(user, {})

    async function platformUpdate(message: object): Promise<Response> {
        return client.request("/tg/platform", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [SECRET_HEADER]: env.PLATFORM_WEBHOOK_SECRET,
            },
            body: JSON.stringify({ message: { chat: { id: 1 }, ...message } }),
        })
    }

    /** The showcase deal, from «Platforma» in Zumda | Business. */
    async function market(percent: number | null, from: object = ADMIN): Promise<Response> {
        return client.as(from, { businessBot: true })(`/api/admin/shops/${shopId}/marketplace`, {
            method: "PUT",
            json: { percent },
        })
    }

    async function addProduct(name: string, category = "meals"): Promise<string> {
        const response = await inShop(OWNER)("/api/owner/products", {
            method: "POST",
            json: { name, price: 30_000, unit: "portion", category },
        })
        return (await json<{ id: string }>(response)).id as string
    }

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const shop = await createActiveShop(client)
        slug = shop.slug
        shopId = shop.id
        await addProduct("To'y oshi")
        await addProduct("Lag'mon", "soups")
    })

    it("a shop without a deal is not in the showcase and cannot be opened through it", async () => {
        const found = await json<{ data: unknown[] }>(
            await viaPlatform(CUSTOMER)("/api/showcase/products?q=osh"),
        )
        expect(found.data).toHaveLength(0)
        expect((await viaShowcase(CUSTOMER)("/api/shop")).status).toBe(404)
    })

    it("only an admin signs a deal; the owner is told", async () => {
        const before = client.telegram.sent.length
        expect((await market(5, STRANGER)).status).toBe(403)
        expect((await market(5, OWNER)).status).toBe(403)
        expect(client.telegram.sent).toHaveLength(before)

        const signed = await market(2.5)
        expect(signed.status).toBe(200)
        const body = await json<{ shop: { marketplace: { commissionBps: number } } }>(signed)
        expect(body.shop.marketplace.commissionBps).toBe(250)
        expect(body.shop).not.toHaveProperty("payoutCard")
        const [toOwner] = client.telegram.sent.slice(before)
        expect(toOwner?.chatId).toBe(OWNER.id)
        expect(toOwner?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(toOwner?.html).toContain("2,5%")
        expect(toOwner?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
            "mode=business",
        )

        expect((await market(-1)).status).toBe(400)
        const ended = await json<{ shop: { marketplace?: unknown } }>(await market(null))
        expect(ended.shop.marketplace).toBeUndefined()
    })

    it("a showcase shop with nothing on sale yet is not listed", async () => {
        await market(5)
        await env.DB.prepare("DELETE FROM products WHERE business_id = ?").bind(shopId).run()
        const shops = await json<{ data: unknown[] }>(
            await viaPlatform(CUSTOMER)("/api/showcase/shops"),
        )
        expect(shops.data).toEqual([])
    })

    it("search finds products in any alphabet, lists shops, hides stop-listed items", async () => {
        await market(5)
        const shops = await json<{ data: { slug: string }[] }>(
            await viaPlatform(CUSTOMER)("/api/showcase/shops"),
        )
        expect(shops.data.map((s) => s.slug)).toEqual([slug])

        const cyrillic = await json<{ data: { name: string; shop: { slug: string } }[] }>(
            await viaPlatform(CUSTOMER)(`/api/showcase/products?q=${encodeURIComponent("лагмон")}`),
        )
        expect(cyrillic.data.map((p) => p.name)).toEqual(["Lag'mon"])
        expect(cyrillic.data[0]?.shop.slug).toBe(slug)

        const byCategory = await json<{ data: unknown[] }>(
            await viaPlatform(CUSTOMER)("/api/showcase/products?category=meals"),
        )
        expect(byCategory.data).toHaveLength(1)

        const [product] = (
            await json<{ data: { id: string }[] }>(
                await viaPlatform(CUSTOMER)("/api/showcase/products?q=osh"),
            )
        ).data
        await inShop(OWNER)(`/api/owner/products/${product?.id ?? ""}`, {
            method: "PATCH",
            json: { stopForToday: true },
        })
        const after = await json<{ data: unknown[] }>(
            await viaPlatform(CUSTOMER)("/api/showcase/products?q=osh"),
        )
        expect(after.data).toHaveLength(0)

        // The showcase lives only in the Zumda bot.
        expect((await inShop(CUSTOMER)("/api/showcase/shops")).status).toBe(400)
    })

    it("an order through the showcase is a marketplace sale with the commission", async () => {
        await market(5)
        const shop = await json(await viaShowcase(OWNER)("/api/shop"))
        // Owner screens open only from the shop's own bot.
        expect(shop).toMatchObject({ viewerRole: "customer" })
        expect((await viaShowcase(OWNER)("/api/owner/orders")).status).toBe(403)

        // The phone comes as a contact to the Zumda bot.
        await platformUpdate({
            from: CUSTOMER,
            chat: { id: CUSTOMER.id },
            contact: { phone_number: "+998901234567", user_id: CUSTOMER.id },
        })
        expect(client.telegram.sent.at(-1)?.chatId).toBe(CUSTOMER.id)

        const products = await json<{ data: { id: string; name: string }[] }>(
            await viaShowcase(CUSTOMER)("/api/shop/products"),
        )
        const osh = products.data.find((p) => p.name === "To'y oshi")
        const placed = await viaShowcase(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId: osh?.id, quantity: 2 }], address: "Navoiy 12" },
        })
        expect(placed.status).toBe(201)
        const order = await json<{ id: string }>(placed)
        expect(order).toMatchObject({
            channel: "marketplace",
            commissionBps: 500,
            commission: 3_000,
            subtotal: 60_000,
        })

        const card = client.telegram.sent.find(
            (m) => m.chatId === OWNER.id && m.html.includes("#1"),
        )
        expect(card?.token).toBe(SHOP_BOT_TOKEN)
        expect(card?.html).toContain("3 000")

        await inShop(OWNER)(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        const toCustomer = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toCustomer?.token).toBe(env.PLATFORM_BOT_TOKEN)
        expect(toCustomer?.html).toContain("Osh Markaz")
    })

    it("the channel comes from the signing bot, never from the client", async () => {
        await market(5)
        // Signed by the shop bot but claiming the showcase: the signature does not match.
        const forged = await client.as(CUSTOMER, {
            botToken: SHOP_BOT_TOKEN,
            shop: slug,
            via: "marketplace",
        })("/api/shop")
        expect(forged.status).toBe(401)

        await inShop(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const products = await json<{ data: { id: string }[] }>(
            await inShop(CUSTOMER)("/api/shop/products"),
        )
        const own = await inShop(CUSTOMER)("/api/orders", {
            method: "POST",
            json: {
                items: [{ productId: products.data[0]?.id, quantity: 1 }],
                address: "Navoiy 12",
                channel: "marketplace",
            },
        })
        expect(await json(own)).toMatchObject({ channel: "shop_bot", commission: 0 })
    })

    it("the Zumda bot welcomes customers with the instruction video and the showcase", async () => {
        await platformUpdate({ from: CUSTOMER, text: "/start" })
        expect(client.telegram.pictures).toHaveLength(0)
        const welcome = client.telegram.videos.at(-1)
        expect(welcome?.video).toEqual({
            url: "https://zumda-app.pages.dev/welcome/zumda.mp4",
            coverUrl: "https://zumda-app.pages.dev/welcome/zumda-cover.jpg",
            width: 720,
            height: 1280,
            durationS: 40,
        })
        expect(welcome?.html).toContain("do'konlar, oshxonalar va xizmatlar")
        const buttons = welcome?.options?.keyboard?.inline_keyboard
        expect(buttons?.[0]?.[0]?.web_app?.url).toContain("mode=market")
        // Businesses connect in Zumda Business: customers see no «connect a business» here.
        expect(buttons).toHaveLength(1)
    })

    it("when Telegram cannot take the video, the street picture goes with the same welcome", async () => {
        client.telegram.failVideos = true
        await platformUpdate({ from: CUSTOMER, text: "/start" })
        expect(client.telegram.videos).toHaveLength(0)
        const welcome = client.telegram.pictures.at(-1)
        expect(welcome?.photoUrl).toBe("https://zumda-app.pages.dev/welcome/zumda.jpg")
        expect(welcome?.html).toContain("do'konlar, oshxonalar va xizmatlar")
        expect(welcome?.options?.keyboard?.inline_keyboard).toHaveLength(1)
    })

    it("when Telegram cannot take the video nor the picture, the same welcome goes as text", async () => {
        client.telegram.failVideos = true
        client.telegram.failPictures = true
        await platformUpdate({ from: CUSTOMER, text: "/start" })
        expect(client.telegram.pictures).toHaveLength(0)
        const text = client.telegram.sent.at(-1)
        expect(text?.html).toContain("do'konlar, oshxonalar va xizmatlar")
        expect(text?.options?.keyboard?.inline_keyboard).toHaveLength(1)
    })

    it("a renamed product is found by its new words only; a deleted one is gone", async () => {
        await market(5)
        const names = async (q: string): Promise<string[]> =>
            (
                await json<{ data: { name: string }[] }>(
                    await viaPlatform(CUSTOMER)(`/api/showcase/products?q=${q}`),
                )
            ).data.map((p) => p.name)
        const id = await addProduct("Qozon kabob")
        expect(await names("qoz")).toEqual(["Qozon kabob"])
        await inShop(OWNER)(`/api/owner/products/${id}`, {
            method: "PATCH",
            json: { name: "Tandir go'sht" },
        })
        expect(await names("qoz")).toEqual([])
        expect(await names("tandir+gosht")).toEqual(["Tandir go'sht"])
        await inShop(OWNER)(`/api/owner/products/${id}`, { method: "DELETE" })
        expect(await names("tandir")).toEqual([])
    })
    it("a Zumda Shop QR: the poster only in the showcase, the shop's bot when it left", async () => {
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
        const poster = (kind: string): Promise<Response> =>
            inShop(OWNER)(`/api/owner/shop/poster?kind=${kind}`, {
                method: "POST",
                headers: { "Content-Type": "image/png" },
                body: png,
            })
        const outside = await poster("zumda")
        expect(outside.status).toBe(422)
        expect(await json(outside)).toMatchObject({ error: { code: "NOT_IN_SHOWCASE" } })
        expect((await poster("other")).status).toBe(400)

        await market(5)
        expect((await poster("zumda")).status).toBe(200)
        const sent = client.telegram.documents.at(-1)
        expect(sent?.file.name).toBe(`${slug}-zumda-qr.png`)
        expect(sent?.caption).toContain("Zumda Shop uchun QR-kod")
        expect((await poster("shop")).status).toBe(200)
        expect(client.telegram.documents.at(-1)?.caption).not.toContain("Zumda Shop")

        // Scanned after the shop left the showcase: Zumda Shop sends the person to its own bot.
        await market(null)
        const bot = await viaPlatform(CUSTOMER)(`/api/showcase/shops/${slug}/bot`)
        expect(await json(bot)).toEqual({ botUsername: SHOP_BOT.username, inShowcase: false })
        expect((await viaPlatform(CUSTOMER)("/api/showcase/shops/no-such-shop/bot")).status).toBe(
            404,
        )
        expect((await viaPlatform(CUSTOMER)("/api/showcase/shops/Bad_Slug/bot")).status).toBe(400)
        // Only from the Zumda bot.
        expect((await inShop(CUSTOMER)(`/api/showcase/shops/${slug}/bot`)).status).toBe(400)
    })
})
