import { env } from "cloudflare:workers"
import { Money, OrderStatus, SendWay } from "@zumda/core"
import { beforeEach, describe, expect, it } from "vitest"

import { D1BusinessRepository } from "../src/repositories/business.repository.js"
import { D1CourierRepository } from "../src/repositories/courier.repository.js"
import { D1OrderRepository } from "../src/repositories/order.repository.js"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STORED_RECEIPT,
    createActiveShop,
    hireCourier,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const DISPATCHER = { id: 5005, first_name: "Dilshod", language_code: "uz" }

/** Migration 0026: the dispatcher, the way, the notes and the carrier's fee are stored. */
describe("dispatchers in D1", () => {
    let client: TestClient
    let shopId: string
    let slug: string

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const shop = await createActiveShop(client)
        shopId = shop.id
        slug = shop.slug
    })

    it("a courier link keeps «Dispetcher»", async () => {
        const courierId = await hireCourier(client, { slug }, DISPATCHER)
        const couriers = new D1CourierRepository(env.DB)
        const link = await couriers.findById(courierId)
        if (!link) {
            throw new Error("courier not found")
        }
        link.setDispatcher(true, new Date())
        await couriers.save(link)
        expect((await new D1CourierRepository(env.DB).findById(courierId))?.isDispatcher).toBe(true)
        expect((await couriers.listByBusiness(shopId)).map((c) => c.isDispatcher)).toEqual([true])
    })

    it("an order keeps its dispatcher, the way and the notes in order", async () => {
        const courierId = await hireCourier(client, { slug }, DISPATCHER)
        const couriers = new D1CourierRepository(env.DB)
        const link = await couriers.findById(courierId)
        if (!link) {
            throw new Error("courier not found")
        }
        link.setDispatcher(true, new Date())
        await couriers.save(link)

        const owner = client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        const product = (await (
            await owner("/api/owner/products", {
                method: "POST",
                json: { name: "Kubik", price: 50_000, unit: "pcs", category: "logic_games" },
            })
        ).json()) as { id: string }
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
        await customer("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const placed = (await (
            await customer("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId: product.id, quantity: 1 }],
                    address: "Navoiy 12",
                    location: { latitude: 38.9785, longitude: 66.6831 },
                },
            })
        ).json()) as { id: string }

        const orders = new D1OrderRepository(env.DB)
        const order = await orders.findById(placed.id)
        if (!order) {
            throw new Error("order not found")
        }
        const at = new Date("2026-11-15T10:00:00Z")
        order.markTransferSent(STORED_RECEIPT)
        order.confirmPaymentAndAccept()
        order.advanceTo(OrderStatus.PREPARING)
        order.assignCourier(link, new Date())
        order.addDeliveryNote(courierId, "Taksi chaqirildi", at)
        order.advanceTo(OrderStatus.READY)
        await orders.save(order)
        order.send(courierId, SendWay.TAXI, "01 A 123 BC", new Date(at.getTime() + 60_000))
        await orders.save(order)

        const stored = await new D1OrderRepository(env.DB).findById(placed.id)
        expect(stored?.isWithDispatcher()).toBe(true)
        expect(stored?.status).toBe(OrderStatus.PICKED_UP)
        expect(stored?.sentVia).toBe(SendWay.TAXI)
        expect(stored?.deliveryNotes.map((note) => [note.at.getTime(), note.text])).toEqual([
            [at.getTime(), "Taksi chaqirildi"],
            [at.getTime() + 60_000, "01 A 123 BC"],
        ])
        expect(stored?.ownerDelivers).toBe(false)
        expect(stored?.customerPaysCarrier).toBe(false)
    })

    it("a shop keeps «Yetkazish haqini mijoz o'zi to'laydi»", async () => {
        const repository = new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
        const shop = await repository.findById(shopId)
        if (!shop) {
            throw new Error("shop not found")
        }
        expect(shop.delivery.customerPaysCarrier).toBeUndefined()
        shop.updateDelivery({ fee: Money.of(10_000), customerPaysCarrier: true })
        await repository.save(shop)
        const stored = await new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY).findById(shopId)
        expect(stored?.delivery).toMatchObject({ customerPaysCarrier: true })
        expect(stored?.delivery.fee.amount).toBe(0)
    })
})
