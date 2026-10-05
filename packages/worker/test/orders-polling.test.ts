/**
 * The owner's screen polls a cheap version and reads the list only when it moves; later pages
 * never count the whole history (the free plan counts rows read).
 */
import { beforeEach, describe, expect, it } from "vitest"

import {
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

interface Page {
    data: { id: string; number: number }[]
    meta: { page: number; limit: number; total: number }
}

describe("owner orders: version and pages", () => {
    let client: TestClient
    let slug: string
    let productId: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })

    const place = async (): Promise<string> => {
        const response = await as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 1 }], address: "Navoiy 12" },
        })
        expect(response.status).toBe(201)
        return ((await response.json()) as { id: string }).id
    }

    const version = async (): Promise<string> =>
        ((await (await as(OWNER)("/api/owner/orders/version")).json()) as { version: string })
            .version

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        const product = await as(OWNER)("/api/owner/products", {
            method: "POST",
            json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
        })
        productId = ((await product.json()) as { id: string }).id
        await as(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
    })

    it("the version moves with a new order and a cancel, and only the owner reads it", async () => {
        const empty = await version()
        const id = await place()
        const one = await version()
        expect(one).not.toBe(empty)
        expect(await version()).toBe(one)
        await as(OWNER)(`/api/owner/orders/${id}`, {
            method: "PATCH",
            json: { status: "cancelled", reason: "Tugadi" },
        })
        expect(await version()).not.toBe(one)
        expect((await as(STRANGER)("/api/owner/orders/version")).status).toBe(403)
    })

    it("no page counts the history: each says only whether more follow", async () => {
        for (let i = 0; i < 5; i++) {
            await place()
        }
        const first = (await (
            await as(OWNER)("/api/owner/orders?filter=active&page=1&limit=2")
        ).json()) as Page
        expect(first.meta.total).toBe(3) // two shown, at least one more
        expect(first.data.map((o) => o.number)).toEqual([5, 4])
        const second = (await (
            await as(OWNER)("/api/owner/orders?filter=active&page=2&limit=2")
        ).json()) as Page
        expect(second.data.map((o) => o.number)).toEqual([3, 2])
        expect(second.meta.total).toBe(5) // two shown, one more follows
        const last = (await (
            await as(OWNER)("/api/owner/orders?filter=active&page=3&limit=2")
        ).json()) as Page
        expect(last.data.map((o) => o.number)).toEqual([1])
        expect(last.meta.total).toBe(5)
    })
})
