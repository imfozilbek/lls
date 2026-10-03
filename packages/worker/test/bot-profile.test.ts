import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    TEST_CARD,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

/** The first bytes of a JPEG: enough for the Worker's type check. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function picture(bytes: Uint8Array, type = "image/jpeg"): RequestInit {
    return { method: "PUT", headers: { "Content-Type": type }, body: bytes }
}

describe("the shop bot's picture and description are Zumda's", () => {
    let client: TestClient

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("right after connecting, the owner's app sets the bot picture", async () => {
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
        const { id } = (await registered.json()) as { id: string }

        const byStranger = await client.as(STRANGER, { businessBot: true })(
            `/api/platform/shops/${id}/bot-photo`,
            picture(JPEG),
        )
        expect(byStranger.status).toBe(404)
        expect(client.telegram.photos).toHaveLength(0)

        const byOwner = await client.as(OWNER, { businessBot: true })(
            `/api/platform/shops/${id}/bot-photo`,
            picture(JPEG),
        )
        expect(byOwner.status).toBe(204)
        expect(client.telegram.photos).toEqual([{ token: SHOP_BOT_TOKEN, jpeg: JPEG }])
    })

    it("«Мой магазин» sets a new picture; only the owner, only a JPEG", async () => {
        const { slug } = await createActiveShop(client)
        const owner = client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })

        expect((await customer("/api/owner/shop/bot-photo", picture(JPEG))).status).toBe(403)
        expect((await owner("/api/owner/shop/bot-photo", picture(PNG, "image/png"))).status).toBe(
            415,
        )
        expect((await owner("/api/owner/shop/bot-photo", picture(PNG))).status).toBe(415)
        expect(client.telegram.photos).toHaveLength(0)

        expect((await owner("/api/owner/shop/bot-photo", picture(JPEG))).status).toBe(204)
        expect(client.telegram.photos).toEqual([{ token: SHOP_BOT_TOKEN, jpeg: JPEG }])

        // Telegram saying no is not our outage: the owner is told, the admins get no alarm.
        client.telegram.failPhotos = true
        const refused = await owner("/api/owner/shop/bot-photo", picture(JPEG))
        expect(refused.status).toBe(422)
        expect(await refused.json()).toMatchObject({ error: { code: "BOT_PHOTO_FAILED" } })
        expect(client.telegram.sent.some((m) => m.html.includes("🚨"))).toBe(false)
    })

    it("a new shop name reaches the bot's description, with «Zumda asosida ishlaydi»", async () => {
        const { slug } = await createActiveShop(client)
        const owner = client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })

        // The application set the first descriptions; only a new name changes them.
        client.telegram.descriptions.splice(0)
        await owner("/api/owner/shop", { method: "PATCH", json: { deliveryFee: 5_000 } })
        expect(client.telegram.descriptions).toHaveLength(0)

        await owner("/api/owner/shop", { method: "PATCH", json: { name: "Osh Saroy" } })
        const [texts] = client.telegram.descriptions
        expect(texts?.token).toBe(SHOP_BOT_TOKEN)
        expect(texts?.description).toContain("Osh Saroy: buyurtmalarni shu yerda qabul qilamiz")
        expect(texts?.description).toContain("«🍽 Menyuni ochish»")
        expect(texts?.description).toContain("Zumda asosida ishlaydi · zumda.shop")
        expect(texts?.shortDescription).toBe(
            "Osh Saroy: uyga buyurtma bering. Zumda asosida ishlaydi",
        )
        expect(texts?.shortDescription.length).toBeLessThanOrEqual(120)
    })
})
