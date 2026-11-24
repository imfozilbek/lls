import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

interface Shop {
    storefrontLayout: string | null
    coverKey?: string
    logoKey?: string
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

const ascii = (text: string): Uint8Array => new TextEncoder().encode(text)
const webp = (tail: number): Uint8Array =>
    new Uint8Array([...ascii("RIFF"), 4, 0, 0, 0, ...ascii("WEBP"), tail])

/**
 * How the storefront looks (owner's decisions, November 2026; goal 24): the owner picks one of
 * four layouts and a cover, customers get them with the shop; new products are marked.
 */
describe("the storefront's look", () => {
    let client: TestClient
    let shopId: string
    let slug: string
    const owner = (): ReturnType<TestClient["as"]> =>
        client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const customer = (): ReturnType<TestClient["as"]> =>
        client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const shop = await createActiveShop(client)
        shopId = shop.id
        slug = shop.slug
    })

    it("a layout the owner chose reaches customers; an unknown one is refused", async () => {
        expect((await json<Shop>(await customer()("/api/shop"))).storefrontLayout).toBeNull()
        const saved = await owner()("/api/owner/shop", {
            method: "PATCH",
            json: { storefrontLayout: "shelves" },
        })
        expect(saved.status).toBe(200)
        expect((await json<Shop>(await customer()("/api/shop"))).storefrontLayout).toBe("shelves")
        for (const storefrontLayout of ["carousel", null, 5]) {
            const refused = await owner()("/api/owner/shop", {
                method: "PATCH",
                json: { storefrontLayout },
            })
            expect(refused.status).toBe(400)
        }
        const stranger = client.as(STRANGER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const forbidden = await stranger("/api/owner/shop", {
            method: "PATCH",
            json: { storefrontLayout: "grid" },
        })
        expect(forbidden.status).toBe(403)
    })

    it("a cover is stored like the logo, replaced and removed with its file", async () => {
        const upload = async (tail: number): Promise<string> => {
            const response = await owner()("/api/owner/shop/cover", {
                method: "PUT",
                headers: { "Content-Type": "image/webp" },
                body: webp(tail),
            })
            expect(response.status).toBe(200)
            return (await json<Required<Shop>>(response)).coverKey
        }
        const first = await upload(1)
        expect(first).toMatch(new RegExp(`^shops/${shopId}/cover/.+\\.webp$`))
        expect((await client.request(`/img/${first}`)).status).toBe(200)
        const second = await upload(2)
        expect(await env.BUCKET.get(first)).toBeNull()
        expect((await json<Shop>(await customer()("/api/shop"))).coverKey).toBe(second)

        const logo = await owner()("/api/owner/shop/logo", {
            method: "PUT",
            headers: { "Content-Type": "image/webp" },
            body: webp(3),
        })
        const logoKey = (await json<Required<Shop>>(logo)).logoKey
        const removed = await owner()("/api/owner/shop/cover", { method: "DELETE" })
        expect(removed.status).toBe(200)
        expect(await json(removed)).not.toHaveProperty("coverKey")
        expect(await env.BUCKET.get(second)).toBeNull()
        // The logo is another picture: it stays.
        expect(await env.BUCKET.get(logoKey)).not.toBeNull()

        const wrongType = await owner()("/api/owner/shop/cover", {
            method: "PUT",
            headers: { "Content-Type": "image/gif" },
            body: webp(4),
        })
        expect(wrongType.status).toBe(415)
        const notTheOwner = await customer()("/api/owner/shop/cover", { method: "DELETE" })
        expect(notTheOwner.status).toBe(403)
    })

    it("the catalog marks what the owner added lately, for «Yangi kelganlar»", async () => {
        await owner()("/api/owner/products", {
            method: "POST",
            json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
        })
        const page = await json<{ data: { addedAt?: string }[] }>(
            await customer()("/api/shop/products"),
        )
        expect(page.data[0]?.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        // Added long ago: an ordinary product.
        await env.DB.prepare("UPDATE products SET created_at = 0").run()
        const later = await json<{ data: object[] }>(await customer()("/api/shop/products"))
        expect(later.data[0]).not.toHaveProperty("addedAt")
    })
})
