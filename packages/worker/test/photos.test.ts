import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

interface Product {
    id: string
    imageKey?: string
    moreImageKeys?: string[]
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0))

/** A real WebP header with its own last byte: every file a different photo. */
const webp = (tail: number): Uint8Array =>
    new Uint8Array([...ascii("RIFF"), 4, 0, 0, 0, ...ascii("WEBP"), tail])

/**
 * Up to three photos of a product (owner's decision, November 2026): the first is the main one
 * (the menu, the showcase, the catalog); the customer swipes through all of them in its sheet.
 */
describe("photos: up to three a product", () => {
    let client: TestClient
    let slug: string
    let productId: string
    const owner = (user: object = OWNER): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })

    const add = (tail: number, user: object = OWNER): Promise<Response> =>
        owner(user)(`/api/owner/products/${productId}/images`, {
            method: "POST",
            headers: { "Content-Type": "image/webp" },
            body: webp(tail),
        })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        const created = await owner()("/api/owner/products", {
            method: "POST",
            json: { name: "Mantiqiy kubik", price: 90_000, unit: "pcs", category: "logic_games" },
        })
        productId = (await json<Product>(created)).id
    })

    it("three photos, the first the main one; a fourth is refused and never stored", async () => {
        const first = await add(1)
        expect(first.status).toBe(201)
        const main = (await json<Product>(first)).imageKey ?? ""
        expect(main).toMatch(/^shops\/.+\/products\/.+\.webp$/)
        await add(2)
        const three = await json<Product>(await add(3))
        expect(three.imageKey).toBe(main)
        expect(three.moreImageKeys).toHaveLength(2)

        const before = (await env.BUCKET.list({ prefix: "shops/" })).objects.length
        const fourth = await add(4)
        expect(fourth.status).toBe(422)
        expect(await json(fourth)).toMatchObject({ error: { code: "TOO_MANY_PHOTOS" } })
        expect((await env.BUCKET.list({ prefix: "shops/" })).objects.length).toBe(before)

        // The customer's storefront carries all three.
        const shelf = await json<{ data: Product[] }>(
            await client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })("/api/shop/products"),
        )
        expect(shelf.data[0]?.moreImageKeys).toEqual(three.moreImageKeys)
    })

    it("the main one taken away: the next is main and the file is gone; a new order", async () => {
        const main = (await json<Product>(await add(1))).imageKey ?? ""
        await add(2)
        const three = await json<Product>(await add(3))
        const [second = "", third = ""] = three.moreImageKeys ?? []

        const removed = await owner()(
            `/api/owner/products/${productId}/images?key=${encodeURIComponent(main)}`,
            { method: "DELETE" },
        )
        expect(await json(removed)).toMatchObject({ imageKey: second, moreImageKeys: [third] })
        expect(await env.BUCKET.get(main)).toBeNull()

        const reordered = await owner()(`/api/owner/products/${productId}/images`, {
            method: "PATCH",
            json: { keys: [third, second] },
        })
        expect(await json(reordered)).toMatchObject({ imageKey: third, moreImageKeys: [second] })

        // A key of no photo of this product, a key of another shape, a stranger: refused.
        const foreign = await owner()(
            `/api/owner/products/${productId}/images?key=${encodeURIComponent(`shops/x/products/y.webp`)}`,
            { method: "DELETE" },
        )
        expect(foreign.status).toBe(404)
        const odd = await owner()(`/api/owner/products/${productId}/images?key=../../secret`, {
            method: "DELETE",
        })
        expect(odd.status).toBe(400)
        expect((await add(5, STRANGER)).status).toBe(403)
        expect(await env.BUCKET.get(second)).not.toBeNull()
    })

    it("the product deleted: every photo of it leaves the storage", async () => {
        const first = await json<Product>(await add(1))
        const both = await json<Product>(await add(2))
        const keys = [first.imageKey ?? "", ...(both.moreImageKeys ?? [])]
        expect(keys).toHaveLength(2)
        for (const key of keys) {
            expect(await env.BUCKET.get(key)).not.toBeNull()
        }
        const deleted = await owner()(`/api/owner/products/${productId}`, { method: "DELETE" })
        expect(deleted.status).toBe(204)
        for (const key of keys) {
            expect(await env.BUCKET.get(key)).toBeNull()
        }
    })
})
