import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    ADMIN,
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const GULISTAN = { latitude: 40.4897, longitude: 68.7842 }
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"

interface Shop {
    id: string
    slug: string
    status: string
    inDistrict: boolean
    hasPayoutCard: boolean
    opensSoon?: boolean
    delivery: { fee: number }
    rejection?: { reason?: string }
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("a short application: name, kind, bot and where the business is", () => {
    let client: TestClient

    const business = (user: object = OWNER): ReturnType<TestClient["as"]> =>
        client.as(user, { businessBot: true })

    async function apply(): Promise<Shop> {
        const response = await business()("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh Markaz",
                type: "food",
                location: GULISTAN,
            },
        })
        expect(response.status).toBe(201)
        return json<Shop>(response)
    }

    async function shopBotStart(): Promise<void> {
        const secret = await env.DB.prepare("SELECT webhook_secret FROM businesses").first<{
            webhook_secret: string
        }>()
        await client.request(`/tg/${SHOP_BOT.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [SECRET_HEADER]: secret?.webhook_secret ?? "",
            },
            body: JSON.stringify({
                message: { from: CUSTOMER, chat: { id: CUSTOMER.id }, text: "/start" },
            }),
        })
    }

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        await business(ADMIN)("/api/admin/districts", {
            method: "PUT",
            json: { name: "Guliston", center: GULISTAN, radiusKm: 30 },
        })
    })

    it("no card and no fee yet: the shop is in its district at once", async () => {
        const shop = await apply()
        expect(shop).toMatchObject({
            status: "pending",
            inDistrict: true,
            hasPayoutCard: false,
            delivery: { fee: 0 },
        })
    })

    it("the bot answers from the application on: «Tez orada ochiladi», no orders yet", async () => {
        const shop = await apply()
        expect(client.telegram.webhooks.map((w) => w.token)).toEqual([SHOP_BOT_TOKEN])
        expect(client.telegram.descriptions[0]?.description).toContain("Zumda asosida ishlaydi")
        expect(client.telegram.commands.at(-1)?.commands).toEqual([
            { command: "start", description: "Boshlash" },
        ])

        await shopBotStart()
        const welcome = client.telegram.sent.at(-1)
        expect(welcome?.chatId).toBe(CUSTOMER.id)
        expect(welcome?.html).toContain("tez orada ochiladi")

        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: shop.slug })
        const storefront = await json<Shop>(await customer("/api/shop"))
        expect(storefront.opensSoon).toBe(true)
        await customer("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const product = await json<{ id: string }>(
            await client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: shop.slug })(
                "/api/owner/products",
                {
                    method: "POST",
                    json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
                },
            ),
        )
        const order = await customer("/api/orders", {
            method: "POST",
            json: { items: [{ productId: product.id, quantity: 1 }], address: "Navoiy 12" },
        })
        expect(order.status).toBe(422)
        expect(await json(order)).toMatchObject({ error: { code: "SHOP_NOT_ACTIVE" } })
    })

    it("approved without a card: the owner is told to add one", async () => {
        const shop = await apply()
        await business(ADMIN)(`/api/admin/shops/${shop.id}`, {
            method: "PATCH",
            json: { decision: "approve" },
        })
        const told = client.telegram.sent.filter((m) => m.chatId === OWNER.id).at(-1)
        expect(told?.html).toContain("ishga tushdi")
        expect(told?.html).toContain("to'lov kartasini qo'shing")
    })

    it("rejected with a reason: the owner reads it, fixes the shop and applies again", async () => {
        const shop = await apply()
        const rejected = await business(ADMIN)(`/api/admin/shops/${shop.id}`, {
            method: "PATCH",
            json: { decision: "reject", reason: "Manzilni aniqroq yozing" },
        })
        expect(await json(rejected)).toMatchObject({
            shop: { status: "disabled", rejection: { reason: "Manzilni aniqroq yozing" } },
        })
        const told = client.telegram.sent.filter((m) => m.chatId === OWNER.id).at(-1)
        expect(told?.html).toContain("rad etildi")
        expect(told?.html).toContain("Sabab: Manzilni aniqroq yozing")
        expect(told?.html).toContain("qayta yuboring")

        // The owner still opens it (to fix it); customers do not.
        const owner = client.as(OWNER, { shop: shop.slug, businessBot: true })
        expect((await owner("/api/owner/shop")).status).toBe(200)
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: shop.slug })
        expect((await customer("/api/shop")).status).toBe(404)
        expect(
            (await owner("/api/owner/shop", { method: "PATCH", json: { address: "Navoiy 20" } }))
                .status,
        ).toBe(200)

        const resubmit = (user: object): Promise<Response> =>
            business(user)(`/api/platform/shops/${shop.id}/resubmit`, { method: "POST" })
        expect((await resubmit(STRANGER)).status).toBe(403)
        const before = client.telegram.sent.length
        const again = await resubmit(OWNER)
        expect(again.status).toBe(200)
        const pending = await json<Shop>(again)
        expect(pending.status).toBe("pending")
        expect(pending.rejection).toBeUndefined()
        const card = client.telegram.sent.slice(before).find((m) => m.chatId === ADMIN.id)
        expect(card?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data).toBe(
            `r:${shop.id}:approve`,
        )
        // Only a rejected application goes back.
        expect((await resubmit(OWNER)).status).toBe(422)
    })

    it("a live shop the admin turns off is not a rejected application", async () => {
        const shop = await apply()
        await business(ADMIN)(`/api/admin/shops/${shop.id}`, {
            method: "PATCH",
            json: { decision: "approve" },
        })
        const off = await business(ADMIN)(`/api/admin/shops/${shop.id}`, {
            method: "PATCH",
            json: { decision: "reject", reason: "ignored" },
        })
        expect((await json<{ shop: Shop }>(off)).shop.rejection).toBeUndefined()
        const resubmit = await business()(`/api/platform/shops/${shop.id}/resubmit`, {
            method: "POST",
        })
        expect(resubmit.status).toBe(422)
    })
})
