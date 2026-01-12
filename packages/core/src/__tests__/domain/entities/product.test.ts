import { describe, it, expect } from "vitest"

import { Product } from "../../../domain/entities/product.js"
import { Money } from "../../../domain/value-objects/money.js"

describe("Product", () => {
    const createProduct = (): Product => {
        return Product.create({
            id: "prod-id",
            businessId: "biz-id",
            name: "Test Product",
            description: "A test product",
            price: Money.create(10000),
            category: "food",
            imageUrl: "https://example.com/image.jpg",
        })
    }

    describe("create", () => {
        it("should create product with valid data", () => {
            const product = createProduct()
            expect(product.id).toBe("prod-id")
            expect(product.name).toBe("Test Product")
            expect(product.price.amount).toBe(10000)
            expect(product.isAvailable).toBe(true)
        })

        it("should create product without image", () => {
            const product = Product.create({
                id: "prod-id",
                businessId: "biz-id",
                name: "Test Product",
                description: "A test product",
                price: Money.create(10000),
                category: "food",
            })
            expect(product.imageUrl).toBeUndefined()
        })
    })

    describe("updateDetails", () => {
        it("should update product details", () => {
            const product = createProduct()
            product.updateDetails("New Name", "New Description", "drinks")
            expect(product.name).toBe("New Name")
            expect(product.description).toBe("New Description")
            expect(product.category).toBe("drinks")
        })
    })

    describe("updatePrice", () => {
        it("should update product price", () => {
            const product = createProduct()
            product.updatePrice(Money.create(20000))
            expect(product.price.amount).toBe(20000)
        })

        it("should throw on zero price", () => {
            const product = createProduct()
            expect(() => product.updatePrice(Money.zero())).toThrow()
        })
    })

    describe("updateImage", () => {
        it("should update product image", () => {
            const product = createProduct()
            product.updateImage("https://example.com/new.jpg")
            expect(product.imageUrl).toBe("https://example.com/new.jpg")
        })

        it("should remove product image", () => {
            const product = createProduct()
            product.updateImage(undefined)
            expect(product.imageUrl).toBeUndefined()
        })
    })

    describe("availability", () => {
        it("should mark product unavailable", () => {
            const product = createProduct()
            product.markUnavailable()
            expect(product.isAvailable).toBe(false)
        })

        it("should mark product available", () => {
            const product = createProduct()
            product.markUnavailable()
            product.markAvailable()
            expect(product.isAvailable).toBe(true)
        })
    })
})
