import { env } from "cloudflare:workers"
import { BusinessStatus, ConflictError } from "@zumda/core"
import { beforeEach, describe, expect, it } from "vitest"

import { D1BusinessRepository } from "../src/repositories/business.repository.js"
import { D1OrderRepository } from "../src/repositories/order.repository.js"

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

/** Two requests that loaded the same row: the later save must not undo the earlier one. */
describe("a save writes only over the version it loaded", () => {
    let client: TestClient
    let shopId: string
    let slug: string

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const shop = await createActiveShop(client)
        shopId = shop.id
        slug = shop.slug
    })

    it("a business: an older copy gets a conflict, the newer change stays", async () => {
        const repository = new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
        const first = await repository.findById(shopId)
        const second = await repository.findById(shopId)
        if (!first || !second) {
            throw new Error("shop not found")
        }
        first.updateProfile({ name: "Yangi nom" })
        await repository.save(first)
        second.setAcceptingOrders(false)
        const stale = await repository.save(second).catch((error: unknown) => error)
        expect(stale).toBeInstanceOf(ConflictError)
        expect((stale as ConflictError).reason).toBe("STALE")
        const stored = await repository.findById(shopId)
        expect(stored?.name).toBe("Yangi nom")
        expect(stored?.acceptingOrders).toBe(true)
        expect(stored?.status).toBe(BusinessStatus.ACTIVE)
        // The same copy saves again and again: each save moves its own version on.
        stored?.setAcceptingOrders(false)
        if (stored) {
            await repository.save(stored)
            stored.setAcceptingOrders(true)
            await repository.save(stored)
        }
    })

    it("an order: a cancel and a confirm from two older copies, one wins", async () => {
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        await customer("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const created = await client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })(
            "/api/owner/products",
            {
                method: "POST",
                json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
            },
        )
        const { id: productId } = (await created.json()) as { id: string }
        const placed = await customer("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 1 }], address: "Navoiy 12" },
        })
        const { id } = (await placed.json()) as { id: string }

        const orders = new D1OrderRepository(env.DB)
        const byCustomer = await orders.findById(id)
        const byOwner = await orders.findById(id)
        if (!byCustomer || !byOwner) {
            throw new Error("order not found")
        }
        byCustomer.cancel("customer")
        await orders.save(byCustomer)
        byOwner.confirmPaymentAndAccept()
        await expect(orders.save(byOwner)).rejects.toBeInstanceOf(ConflictError)
        expect((await orders.findById(id))?.status).toBe("cancelled")
    })
})
