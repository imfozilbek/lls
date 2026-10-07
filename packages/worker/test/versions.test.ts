import { env } from "cloudflare:workers"
import {
    BusinessRuleViolationError,
    BusinessStatus,
    ConflictError,
    PayoutCard,
    PayoutCardBook,
} from "@zumda/core"
import { beforeEach, describe, expect, it } from "vitest"

import { D1BusinessRepository } from "../src/repositories/business.repository.js"
import { D1OrderRepository } from "../src/repositories/order.repository.js"
import { D1PayoutCardRepository } from "../src/repositories/payout-card.repository.js"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    TEST_CARD,
    createActiveShop,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"
import type { Business, SavedPayoutCard } from "@zumda/core"

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
        // Two requests: each has its own repository (and its own copy of the shop).
        const repository = new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
        const first = await repository.findById(shopId)
        const second = await new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY).findById(shopId)
        if (!first || !second) {
            throw new Error("shop not found")
        }
        first.updateProfile({ name: "Yangi nom" })
        await repository.save(first)
        second.setAcceptingOrders(false)
        const stale = await repository.save(second).catch((error: unknown) => error)
        expect(stale).toBeInstanceOf(ConflictError)
        expect((stale as ConflictError).reason).toBe("STALE")
        const stored = await new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY).findById(shopId)
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

/** The first card and the shop are one write: both are saved, or neither. */
describe("the shop and its first card", () => {
    let shopId: string
    const repository = (): D1BusinessRepository =>
        new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
    const load = async (): Promise<Business> => {
        const shop = await repository().findById(shopId)
        if (!shop) {
            throw new Error("shop not found")
        }
        return shop
    }
    const cardsOf = async (): Promise<string[]> =>
        (await new D1PayoutCardRepository(env.DB).listByBusiness(shopId)).map((c) => c.id)
    const firstCard = (shop: Business, number = TEST_CARD.number): SavedPayoutCard =>
        new PayoutCardBook(shop, []).add({
            id: crypto.randomUUID(),
            card: PayoutCard.create(number, TEST_CARD.holder),
            now: new Date(),
        })

    beforeEach(async () => {
        const client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        shopId = (await createActiveShop(client)).id
        // The application came with its card in the same write.
        const registered = await load()
        expect(await cardsOf()).toEqual([registered.paymentCardId])
        // A shop that has no card yet (its card comes later, in «To'lov»).
        await env.DB.batch([
            env.DB.prepare("DELETE FROM payout_cards WHERE business_id = ?").bind(shopId),
            env.DB.prepare(
                `UPDATE businesses SET payment_card_id = NULL, payout_card_number = NULL,
                    payout_card_holder = NULL WHERE id = ?`,
            ).bind(shopId),
        ])
    })

    it("saved together: the card is in the list and customers are shown it", async () => {
        const shop = await load()
        const card = firstCard(shop)
        await repository().saveWithCard(shop, card)
        expect(await cardsOf()).toEqual([card.id])
        expect((await load()).paymentCardId).toBe(card.id)
    })

    it("an older copy of the shop: 409, and no card is left behind", async () => {
        const older = await load()
        const newer = await load()
        newer.updateProfile({ name: "Yangi nom" })
        await repository().save(newer)
        const card = firstCard(older)
        const stale = await repository()
            .saveWithCard(older, card)
            .catch((error: unknown) => error)
        expect(stale).toBeInstanceOf(ConflictError)
        expect((stale as ConflictError).reason).toBe("STALE")
        expect(await cardsOf()).toEqual([])
        const stored = await load()
        expect(stored.paymentCardId).toBeUndefined()
        expect(stored.name).toBe("Yangi nom")
    })

    it("a card the shop already has: CARD_EXISTS, and the shop is not changed", async () => {
        const listed = firstCard(await load())
        await new D1PayoutCardRepository(env.DB).insert(shopId, listed)
        const shop = await load()
        shop.updateProfile({ name: "Boshqa nom" })
        const twin = await repository()
            .saveWithCard(shop, firstCard(shop))
            .catch((error: unknown) => error)
        expect(twin).toBeInstanceOf(BusinessRuleViolationError)
        expect((twin as BusinessRuleViolationError).rule).toBe("CARD_EXISTS")
        expect(await cardsOf()).toEqual([listed.id])
        const stored = await load()
        expect(stored.paymentCardId).toBeUndefined()
        expect(stored.name).toBe("Osh Markaz")
    })
})
