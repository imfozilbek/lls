import { beforeEach, describe, expect, it, vi } from "vitest"

import {
    MAX_STEPS,
    deliveryFee,
    fitQuantity,
    lineKey,
    lineTotal,
    pickPrice,
    productOfKey,
    summarize,
    useCart,
} from "./cart.js"

import type { ProductDTO } from "@zumda/core"

function product(id: string, price: number, isAvailable = true): ProductDTO {
    return {
        id,
        businessId: "b1",
        name: id,
        price,
        unit: "pcs",
        category: "meals",
        isAvailable,
        position: 0,
    } as ProductDTO
}

function memoryStorage(): Storage {
    const data = new Map<string, string>()
    return {
        get length(): number {
            return data.size
        },
        clear: (): void => data.clear(),
        getItem: (key): string | null => data.get(key) ?? null,
        key: (index): string | null => [...data.keys()][index] ?? null,
        removeItem: (key): void => void data.delete(key),
        setItem: (key, value): void => void data.set(key, value),
    }
}

describe("cart store", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", memoryStorage())
        useCart.getState().load("osh")
    })

    it("adds, removes and drops a line at zero", () => {
        const cart = useCart.getState()
        cart.add("p1")
        cart.add("p1")
        expect(useCart.getState().lines).toEqual({ p1: 2 })
        cart.remove("p1")
        cart.remove("p1")
        expect(useCart.getState().lines).toEqual({})
    })

    it("caps a line at 99 steps", () => {
        for (let i = 0; i < MAX_STEPS + 5; i++) {
            useCart.getState().add("p1")
        }
        expect(useCart.getState().lines["p1"]).toBe(MAX_STEPS)
    })

    it("adds and removes weight items in their step (grams)", () => {
        const cart = useCart.getState()
        cart.add("kg", 500)
        cart.add("kg", 500)
        cart.add("kg", 500)
        expect(useCart.getState().lines["kg"]).toBe(1500)
        cart.remove("kg", 500)
        expect(useCart.getState().lines["kg"]).toBe(1000)
        cart.remove("kg", 500)
        cart.remove("kg", 500)
        expect(useCart.getState().lines["kg"]).toBeUndefined()
    })

    it("keeps a separate cart per shop", () => {
        useCart.getState().add("p1")
        useCart.getState().load("suv")
        expect(useCart.getState().lines).toEqual({})
        useCart.getState().add("w1")
        useCart.getState().load("osh")
        expect(useCart.getState().lines).toEqual({ p1: 1 })
    })

    it("ignores broken stored data", () => {
        localStorage.setItem("zumda:cart:bad", '{"p1":"x","p2":-1,"p3":2}')
        useCart.getState().load("bad")
        expect(useCart.getState().lines).toEqual({ p3: 2 })
        localStorage.setItem("zumda:cart:worse", "not json")
        useCart.getState().load("worse")
        expect(useCart.getState().lines).toEqual({})
    })
})

describe("refill (reorder)", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", memoryStorage())
        useCart.getState().load("osh")
    })

    it("puts back what is on sale and reports what is not", () => {
        const catalog = [product("a", 1_000), product("b", 2_000, false)]
        const skipped = useCart.getState().refill(
            [
                { productId: "a", quantity: 2 },
                { productId: "b", quantity: 1 },
                { productId: "gone", quantity: 1 },
            ],
            catalog,
        )
        expect(skipped).toBe(2)
        expect(useCart.getState().lines).toEqual({ a: 2 })
    })
})

describe("summarize", () => {
    it("uses today's catalog prices and splits out sold-out lines", () => {
        const catalog = [product("a", 10_000), product("b", 5_000, false)]
        const summary = summarize({ a: 3, b: 1, gone: 2 }, catalog)
        expect(summary.count).toBe(1)
        expect(summary.subtotal).toBe(30_000)
        expect(summary.unavailable.map((l) => l.product.id)).toEqual(["b"])
        expect(summary.lines.map((l) => l.product.id)).toEqual(["a"])
    })
})

describe("weight items and bottles", () => {
    it("prices kilograms per gram and rounds like the server", () => {
        const tomato = { ...product("t", 12_000), unit: "kg", step: 500 } as ProductDTO
        expect(lineTotal(tomato, 1500)).toBe(18_000)
        expect(lineTotal({ ...tomato, price: 9_999 } as ProductDTO, 250)).toBe(2_500)
    })

    it("counts returnable bottles for the deposit", () => {
        const bottle = { ...product("w", 15_000), returnable: true } as ProductDTO
        const summary = summarize({ w: 3, a: 1 }, [bottle, product("a", 1_000)])
        expect(summary.returnable).toBe(3)
        expect(summary.count).toBe(2)
    })
})

describe("deliveryFee", () => {
    it("is free from the threshold", () => {
        expect(deliveryFee(49_999, { fee: 10_000, freeFrom: 50_000 })).toBe(10_000)
        expect(deliveryFee(50_000, { fee: 10_000, freeFrom: 50_000 })).toBe(0)
        expect(deliveryFee(1, { fee: 7_000 })).toBe(7_000)
    })
})

describe("prune", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", memoryStorage())
        useCart.getState().load("osh")
    })

    it("drops products that left the catalog and reports how many", () => {
        useCart.getState().setQuantity("a", 2)
        useCart.getState().setQuantity("gone", 1)
        expect(useCart.getState().prune([product("a", 1), product("b", 1)])).toBe(1)
        expect(useCart.getState().lines).toEqual({ a: 2 })
        expect(useCart.getState().prune([product("a", 1)])).toBe(0)
    })

    it("fits a line to a step the owner changed, never to zero", () => {
        const rice = { ...product("rice", 20_000), unit: "kg", step: 500 } as ProductDTO
        useCart.getState().setQuantity("rice", 750)
        expect(useCart.getState().prune([rice])).toBe(0)
        expect(useCart.getState().lines).toEqual({ rice: 1000 })
        expect(fitQuantity(100, 500)).toBe(500)
        expect(fitQuantity(5_000_000, 500)).toBe(500 * MAX_STEPS)
    })

    it("drops a pick whose variant the owner removed", () => {
        useCart.getState().setQuantity(lineKey("latte", { variantId: "m", addonIds: [] }), 1)
        useCart.getState().setQuantity(lineKey("latte", { variantId: "xl", addonIds: [] }), 1)
        expect(useCart.getState().prune([latte()])).toBe(1)
        expect(Object.keys(useCart.getState().lines)).toEqual(["latte~m~"])
    })
})

function latte(): ProductDTO {
    return {
        ...product("latte", 15_000),
        options: {
            group: "Hajmi",
            variants: [
                { id: "s", name: "0,3 l", price: 15_000 },
                { id: "m", name: "0,4 l", price: 18_000 },
            ],
            addons: [
                { id: "syrup", name: "Karamel sirop", price: 4_000 },
                { id: "free", name: "Shakarsiz", price: 0 },
            ],
        },
    }
}

describe("variants and add-ons in the cart", () => {
    it("a pick is its own line, priced like the server and named for the customer", () => {
        const key = lineKey("latte", { variantId: "m", addonIds: ["syrup", "free"] })
        expect(key).toBe("latte~m~free.syrup")
        expect(productOfKey(key)).toBe("latte")
        const cart = summarize({ [key]: 2, "latte~s~": 1 }, [latte()])
        expect(cart.lines.map((l) => [l.label, l.total])).toEqual([
            ["0,4 l · Karamel sirop, Shakarsiz", 44_000],
            ["0,3 l", 15_000],
        ])
        expect(cart.subtotal).toBe(59_000)
    })

    it("a pick that no longer fits is shown apart, and the plain product needs a variant", () => {
        expect(pickPrice(latte(), undefined)).toBeNull()
        expect(pickPrice(latte(), { variantId: "m", addonIds: ["gold"] })).toBeNull()
        const cart = summarize({ "latte~xl~": 1 }, [latte()])
        expect(cart.lines).toHaveLength(0)
        expect(cart.unavailable).toHaveLength(1)
    })
})
