import { beforeEach, describe, expect, it, vi } from "vitest"

import { MAX_STEPS, deliveryFee, lineTotal, summarize, useCart } from "./cart.js"

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
        localStorage.setItem("lls:cart:bad", '{"p1":"x","p2":-1,"p3":2}')
        useCart.getState().load("bad")
        expect(useCart.getState().lines).toEqual({ p3: 2 })
        localStorage.setItem("lls:cart:worse", "not json")
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

    it("drops products that are no longer on sale and reports how many", () => {
        useCart.getState().setQuantity("a", 2)
        useCart.getState().setQuantity("gone", 1)
        expect(useCart.getState().prune(["a", "b"])).toBe(1)
        expect(useCart.getState().lines).toEqual({ a: 2 })
        expect(useCart.getState().prune(["a"])).toBe(0)
    })
})
