import { describe, expect, it } from "vitest"

import { DeliveryPrice } from "@zumda/core"

import { cartDelivery, deliveryFact, orderDelivery, shopDelivery } from "./delivery-price.js"

import type { ShopPublicDTO } from "@zumda/core"

const shop = (price: DeliveryPrice, fee = 0): ShopPublicDTO["delivery"] => ({
    fee,
    price,
    customerPaysCarrier: price === DeliveryPrice.LATER,
})

const words = { free: "Bepul yetkazish", later: "Keyin", fee: (sum: number): string => `${sum}` }

describe("what a screen says about delivery", () => {
    it("the storefront: a fee, «bepul» only when chosen, «later», or nothing", () => {
        expect(shopDelivery(shop(DeliveryPrice.FEE, 10_000))).toBe(10_000)
        expect(shopDelivery(shop(DeliveryPrice.FREE))).toBe("free")
        expect(shopDelivery(shop(DeliveryPrice.LATER))).toBe("later")
        // Never chosen, or a service: a fee of 0 says nothing.
        expect(shopDelivery(shop(DeliveryPrice.UNSET))).toBeNull()
        expect(shopDelivery(shop(DeliveryPrice.NONE))).toBeNull()
    })

    it("the cart: past «… dan bepul» the fee is «bepul»", () => {
        expect(cartDelivery(shop(DeliveryPrice.FEE, 10_000), 10_000)).toBe(10_000)
        expect(cartDelivery(shop(DeliveryPrice.FEE, 10_000), 0)).toBe("free")
        expect(cartDelivery(shop(DeliveryPrice.UNSET), 0)).toBeNull()
    })

    it("an order: what was promised when it was placed", () => {
        const order = { deliveryFee: 0, deliveryFree: false, customerPaysCarrier: false }
        expect(orderDelivery(order)).toBeNull()
        expect(orderDelivery({ ...order, deliveryFree: true })).toBe("free")
        expect(orderDelivery({ ...order, deliveryFee: 12_000 })).toBe(12_000)
        expect(orderDelivery({ ...order, customerPaysCarrier: true })).toBe("later")
    })

    it("the fact in the screen's own words, or none", () => {
        expect(deliveryFact("free", words)).toBe("Bepul yetkazish")
        expect(deliveryFact("later", words)).toBe("Keyin")
        expect(deliveryFact(5_000, words)).toBe("5000")
        expect(deliveryFact(null, words)).toBeNull()
    })
})
