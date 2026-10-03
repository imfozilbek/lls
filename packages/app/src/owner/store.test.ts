import { describe, expect, it } from "vitest"

import { useOwner } from "./store.js"

import type { ProductDTO } from "@zumda/core"

describe("the owner section across several businesses", () => {
    it("another business starts clean; the same one keeps its data", () => {
        const owner = useOwner.getState()
        owner.bindShop("shop-a")
        useOwner.setState({ products: [{ id: "p-a" } as ProductDTO], couriers: [], tab: "money" })
        useOwner.getState().focusOrder("order-b")

        useOwner.getState().bindShop("shop-a")
        expect(useOwner.getState().products).toHaveLength(1)

        useOwner.getState().bindShop("shop-b")
        const state = useOwner.getState()
        expect(state.products).toBeNull()
        expect(state.couriers).toBeNull()
        expect(state.tab).toBe("orders")
        // The order a bot message asked for belongs to the business opening now.
        expect(state.focusOrderId).toBe("order-b")
    })
})
