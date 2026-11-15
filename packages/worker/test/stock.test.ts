import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { D1ProductRepository } from "../src/repositories/product.repository.js"

import {
    CUSTOMER,
    OWNER,
    PIN,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

interface Product {
    id: string
    stock?: number
    soldOut?: true
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

/**
 * The shop's stock (owner's decisions, November 2026): counted per product when the owner wants,
 * one number for every variant, taken when the order is placed and given back on a cancel. At
 * zero the customer still sees the product and cannot add it.
 */
describe("stock: what is left of a product", () => {
    let client: TestClient
    let slug: string
    let productId: string
    const owner = (): ReturnType<TestClient["as"]> =>
        client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const customer = (user: object = CUSTOMER): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })

    async function order(quantity: number, user: object = CUSTOMER): Promise<Response> {
        return customer(user)("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity }], address: "Navoiy 12", location: PIN },
        })
    }

    async function stored(): Promise<number | null | undefined> {
        const row = await env.DB.prepare("SELECT stock FROM products WHERE id = ?")
            .bind(productId)
            .first<{ stock: number | null }>()
        return row?.stock
    }

    async function shelf(user: object = CUSTOMER): Promise<Product | undefined> {
        const page = await json<{ data: Product[] }>(await customer(user)("/api/shop/products"))
        return page.data.find((p) => p.id === productId)
    }

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        const created = await owner()("/api/owner/products", {
            method: "POST",
            json: {
                name: "Mantiqiy kubik",
                price: 90_000,
                unit: "pcs",
                category: "logic_games",
                stock: 2,
            },
        })
        expect(created.status).toBe(201)
        productId = (await json<Product>(created)).id
        for (const user of [CUSTOMER, STRANGER]) {
            await customer(user)("/api/me")
            await sharePhoneWithShops(user.id)
        }
    })

    it("the order takes it; the customer never sees the number, only that it is gone", async () => {
        expect(await shelf()).not.toHaveProperty("stock")
        expect((await order(2)).status).toBe(201)
        expect(await stored()).toBe(0)

        const gone = await shelf()
        expect(gone).toMatchObject({ soldOut: true })
        expect(gone).not.toHaveProperty("stock")
        const mine = await json<{ data: Product[] }>(await owner()("/api/owner/products"))
        expect(mine.data.find((p) => p.id === productId)).toMatchObject({ stock: 0 })

        const refused = await order(1)
        expect(refused.status).toBe(422)
        expect(await json(refused)).toMatchObject({
            error: { code: "OUT_OF_STOCK", details: { productId, left: 0 } },
        })
    })

    it("a cancel gives it back once, however often the order is saved", async () => {
        const placed = await json<{ id: string }>(await order(2))
        const cancel = (): Promise<Response> =>
            customer()(`/api/orders/${placed.id}`, {
                method: "PATCH",
                json: { status: "cancelled" },
            })
        expect((await cancel()).status).toBe(200)
        expect(await stored()).toBe(2)
        // Pressed again: the order is final, nothing more comes back.
        expect((await cancel()).status).not.toBe(200)
        expect(await stored()).toBe(2)
    })

    it("two customers and the last piece: one order, the other hears none is left", async () => {
        await owner()(`/api/owner/products/${productId}`, {
            method: "PATCH",
            json: { stock: 1 },
        })
        const both = await Promise.all([order(1), order(1, STRANGER)])
        expect(both.map((r) => r.status).sort()).toEqual([201, 422])
        expect(await stored()).toBe(0)
        const counts = await env.DB.prepare(
            "SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_items) AS items",
        ).first()
        expect(counts).toEqual({ orders: 1, items: 1 })
    })

    it("a plain edit of an older copy never brings the old count back", async () => {
        const products = new D1ProductRepository(env.DB)
        const older = await products.findById(productId)
        expect((await order(1)).status).toBe(201)
        older?.update({ name: "Rubik kubigi" })
        if (older) {
            await products.save(older)
        }
        expect(await stored()).toBe(1)

        // A new count is the owner's: it is written as given; null stops counting.
        await owner()(`/api/owner/products/${productId}`, {
            method: "PATCH",
            json: { stock: 7 },
        })
        expect(await stored()).toBe(7)
        await owner()(`/api/owner/products/${productId}`, {
            method: "PATCH",
            json: { stock: null },
        })
        expect(await stored()).toBeNull()
        expect((await order(5)).status).toBe(201)
        expect(await stored()).toBeNull()
        const bad = await owner()(`/api/owner/products/${productId}`, {
            method: "PATCH",
            json: { stock: -1 },
        })
        expect(bad.status).toBe(400)
    })
})
