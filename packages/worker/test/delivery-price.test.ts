import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

interface ShopDelivery {
    delivery: {
        fee: number
        freeFrom?: number
        price: string
        customerPaysCarrier: boolean
        nationwide: boolean
        radiusMeters?: number
    }
}

/** The delivery price is the owner's choice (owner's decision, November 2026). */
describe("delivery price", () => {
    let client: TestClient
    let slug: string
    let shopId: string

    const owner = (): ReturnType<TestClient["as"]> =>
        client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const storefront = async (): Promise<ShopDelivery> =>
        (await (
            await client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })("/api/shop")
        ).json()) as ShopDelivery
    const save = (delivery: object): Promise<Response> =>
        owner()("/api/owner/shop", { method: "PATCH", json: { delivery } })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        ;({ slug, id: shopId } = await createActiveShop(client))
    })

    it("a shop that never chose shows no price: a fee of 0 is not «bepul»", async () => {
        // As an application leaves it: no fee, nothing chosen.
        await env.DB.prepare(
            `UPDATE businesses SET delivery_fee = 0, free_delivery_from = NULL,
                delivery_price_set = 0 WHERE id = ?`,
        )
            .bind(shopId)
            .run()
        expect((await storefront()).delivery).toMatchObject({ fee: 0, price: "unset" })
        // Another setting saved sends the delivery fields too: the choice is still not made.
        expect((await save({ fee: 0, radiusMeters: 5_000 })).status).toBe(200)
        expect((await storefront()).delivery.price).toBe("unset")
    })

    it("«Bepul», «Narxi bor» (a price above 0) and «Narxi keyin aytiladi»", async () => {
        expect((await storefront()).delivery).toMatchObject({ fee: 10_000, price: "fee" })
        const zero = await save({ fee: 0, price: "fee" })
        expect(zero.status).toBe(400)

        expect((await save({ fee: 10_000, freeFrom: 200_000, price: "free" })).status).toBe(200)
        expect((await storefront()).delivery).toMatchObject({ fee: 0, price: "free" })
        expect((await storefront()).delivery.freeFrom).toBeUndefined()
        const stored = await env.DB.prepare(
            "SELECT delivery_price_set, delivery_fee FROM businesses WHERE id = ?",
        )
            .bind(shopId)
            .first<{ delivery_price_set: number; delivery_fee: number }>()
        expect(stored).toEqual({ delivery_price_set: 1, delivery_fee: 0 })

        expect((await save({ fee: 0, price: "later" })).status).toBe(200)
        expect((await storefront()).delivery).toMatchObject({
            fee: 0,
            price: "later",
            customerPaysCarrier: true,
        })

        expect((await save({ fee: 12_000, price: "fee" })).status).toBe(200)
        expect((await storefront()).delivery).toMatchObject({
            fee: 12_000,
            price: "fee",
            customerPaysCarrier: false,
        })
    })

    it("«O'zbekiston bo'ylab yetkazamiz»: only with the carrier, no radius, kept until changed", async () => {
        // A shop with its own fee has its own couriers: never the whole country.
        const refused = await save({ fee: 10_000, radiusMeters: 5_000, nationwide: true })
        expect(refused.status).toBe(422)
        expect(((await refused.json()) as { error: { code: string } }).error.code).toBe(
            "NATIONWIDE_NEEDS_CARRIER",
        )
        expect(
            (await save({ fee: 0, radiusMeters: 5_000, price: "later", nationwide: true })).status,
        ).toBe(200)
        expect((await storefront()).delivery).toMatchObject({ price: "later", nationwide: true })
        expect((await storefront()).delivery.radiusMeters).toBeUndefined()
        // Another save without the switch keeps it; another price turns it off.
        expect((await save({ fee: 0, radiusMeters: 5_000 })).status).toBe(200)
        expect((await storefront()).delivery.nationwide).toBe(true)
        expect((await save({ fee: 0, radiusMeters: 5_000, price: "free" })).status).toBe(200)
        expect((await storefront()).delivery).toMatchObject({ price: "free", nationwide: false })
        const stored = await env.DB.prepare(
            "SELECT delivers_nationwide FROM businesses WHERE id = ?",
        )
            .bind(shopId)
            .first<{ delivers_nationwide: number }>()
        expect(stored?.delivers_nationwide).toBe(0)
    })

    it("an unknown choice is refused", async () => {
        expect((await save({ fee: 0, price: "unset" })).status).toBe(400)
        expect((await save({ fee: 0, price: "cheap" })).status).toBe(400)
    })
})
