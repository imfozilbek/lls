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

describe("LLS showcase", () => {
    let client: TestClient
    let slug: string

    const inShop = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
    /** The shop's storefront opened from the showcase, inside the LLS bot. */
    const viaShowcase = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { shop: slug, via: "marketplace" })
    const lls = (user: object): ReturnType<TestClient["as"]> => client.as(user, {})

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

    async function market(args: string, from: object = ADMIN): Promise<void> {
        await platformUpdate({ from, text: `/market ${args}` })
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
        slug = (await createActiveShop(client)).slug
        await addProduct("To'y oshi")
        await addProduct("Lag'mon", "soups")
    })

    it("a shop without a deal is not in the showcase and cannot be opened through it", async () => {
        const found = await json<{ data: unknown[] }>(
            await lls(CUSTOMER)("/api/showcase/products?q=osh"),
        )
        expect(found.data).toHaveLength(0)
        expect((await viaShowcase(CUSTOMER)("/api/shop")).status).toBe(404)
    })

    it("only an admin signs a deal; the owner is told", async () => {
        const before = client.telegram.sent.length
        await market(`${slug} 5`, STRANGER)
        expect(client.telegram.sent).toHaveLength(before)

        await market(`${slug} 5`)
        const [toAdmin, toOwner] = client.telegram.sent.slice(before)
        expect(toAdmin?.chatId).toBe(1)
        expect(toAdmin?.html).toContain("5%")
        expect(toOwner?.chatId).toBe(OWNER.id)
        expect(toOwner?.token).toBe(env.PLATFORM_BOT_TOKEN)

        await market("nonsense")
        expect(client.telegram.sent.at(-1)?.html).toContain("/market")
    })

    it("search finds products in any alphabet, lists shops, hides stop-listed items", async () => {
        await market(`${slug} 5`)
        const shops = await json<{ data: { slug: string }[] }>(
            await lls(CUSTOMER)("/api/showcase/shops"),
        )
        expect(shops.data.map((s) => s.slug)).toEqual([slug])

        const cyrillic = await json<{ data: { name: string; shop: { slug: string } }[] }>(
            await lls(CUSTOMER)(`/api/showcase/products?q=${encodeURIComponent("лагмон")}`),
        )
        expect(cyrillic.data.map((p) => p.name)).toEqual(["Lag'mon"])
        expect(cyrillic.data[0]?.shop.slug).toBe(slug)

        const byCategory = await json<{ data: unknown[] }>(
            await lls(CUSTOMER)("/api/showcase/products?category=meals"),
        )
        expect(byCategory.data).toHaveLength(1)

        const [product] = (
            await json<{ data: { id: string }[] }>(
                await lls(CUSTOMER)("/api/showcase/products?q=osh"),
            )
        ).data
        await inShop(OWNER)(`/api/owner/products/${product?.id ?? ""}`, {
            method: "PATCH",
            json: { stopForToday: true },
        })
        const after = await json<{ data: unknown[] }>(
            await lls(CUSTOMER)("/api/showcase/products?q=osh"),
        )
        expect(after.data).toHaveLength(0)

        // The showcase lives only in the LLS bot.
        expect((await inShop(CUSTOMER)("/api/showcase/shops")).status).toBe(400)
    })

    it("an order through the showcase is a marketplace sale with the commission", async () => {
        await market(`${slug} 5`)
        const shop = await json(await viaShowcase(OWNER)("/api/shop"))
        // Owner screens open only from the shop's own bot.
        expect(shop).toMatchObject({ viewerRole: "customer" })
        expect((await viaShowcase(OWNER)("/api/owner/orders")).status).toBe(403)

        // The phone comes as a contact to the LLS bot.
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

        await inShop(OWNER)(`/api/owner/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "accepted" },
        })
        const toCustomer = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toCustomer?.token).toBe(env.PLATFORM_BOT_TOKEN)
        expect(toCustomer?.html).toContain("Osh Markaz")
    })

    it("the channel comes from the signing bot, never from the client", async () => {
        await market(`${slug} 5`)
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

    it("the LLS bot welcomes with the showcase and onboarding buttons", async () => {
        await platformUpdate({ from: CUSTOMER, text: "/start" })
        const buttons = client.telegram.sent.at(-1)?.options?.keyboard?.inline_keyboard
        expect(buttons?.[0]?.[0]?.web_app?.url).toContain("mode=market")
        expect(buttons?.[1]?.[0]?.web_app?.url).toContain("mode=onboarding")
    })
})
