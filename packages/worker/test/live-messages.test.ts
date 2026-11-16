import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { D1OrderRepository } from "../src/repositories/order.repository.js"

import {
    CUSTOMER,
    OWNER,
    PIN,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

/**
 * Migration 0033: the customer's one live message per order, and the bot that holds the owner's
 * card (the shop's own, or Zumda | Business while the shop's bot may not write to the owner).
 */
describe("the messages of an order in D1", () => {
    let client: TestClient
    let orderId: string

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const { slug } = await createActiveShop(client)
        const as = (user: object): ReturnType<TestClient["as"]> =>
            client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const product = await json<{ id: string }>(
            await as(OWNER)("/api/owner/products", {
                method: "POST",
                json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
            }),
        )
        await as(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const order = await json<{ id: string }>(
            await as(CUSTOMER)("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId: product.id, quantity: 1 }],
                    address: "Navoiy 12",
                    location: PIN,
                },
            }),
        )
        orderId = order.id
    })

    it("keeps the customer's message and where the owner's card is", async () => {
        const orders = new D1OrderRepository(env.DB)
        const placed = await orders.getMessageIds(orderId)
        expect(placed.ownerVia).toBe("shop")
        await orders.setMessageId(orderId, "customer", 501)
        await orders.setMessageId(orderId, "owner", 502, "business")
        await orders.setMessageId(orderId, "courier", 503)
        expect(await orders.getMessageIds(orderId)).toEqual({
            owner: 502,
            ownerVia: "business",
            courier: 503,
            customer: 501,
        })
        // The shop's bot writes again: its new card is the one edited from now on.
        await orders.setMessageId(orderId, "owner", 504)
        expect(await orders.getMessageIds(orderId)).toMatchObject({ owner: 504, ownerVia: "shop" })
    })
})
