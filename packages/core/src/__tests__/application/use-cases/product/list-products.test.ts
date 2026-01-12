import { describe, it, expect, vi, beforeEach } from "vitest"

import { ListProductsUseCase } from "../../../../application/use-cases/product/list-products.use-case.js"
import { Product } from "../../../../domain/entities/product.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { ProductRepository } from "../../../../application/ports/product-repository.js"

describe("ListProductsUseCase", () => {
    let useCase: ListProductsUseCase
    let mockRepository: ProductRepository

    const testProducts = [
        Product.create({
            id: "product-1",
            businessId: "business-1",
            name: "Pizza",
            description: "Italian pizza",
            category: "Food",
            price: Money.create(50000, "UZS"),
            imageUrl: undefined,
        }),
        Product.create({
            id: "product-2",
            businessId: "business-1",
            name: "Pasta",
            description: "Italian pasta",
            category: "Food",
            price: Money.create(40000, "UZS"),
            imageUrl: undefined,
        }),
    ]

    beforeEach(() => {
        mockRepository = {
            findById: vi.fn(),
            findByBusinessId: vi.fn(),
            findAvailableByBusinessId: vi.fn(),
            findByCategory: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new ListProductsUseCase(mockRepository)
    })

    it("should return products for business", async () => {
        vi.mocked(mockRepository.findByBusinessId).mockResolvedValue(testProducts)

        const result = await useCase.execute({ businessId: "business-1" })

        expect(result).toHaveLength(2)
        expect(result[0].name).toBe("Pizza")
        expect(result[1].name).toBe("Pasta")
        expect(mockRepository.findByBusinessId).toHaveBeenCalledWith("business-1")
    })

    it("should return empty array when no products", async () => {
        vi.mocked(mockRepository.findByBusinessId).mockResolvedValue([])

        const result = await useCase.execute({ businessId: "business-1" })

        expect(result).toHaveLength(0)
    })
})
