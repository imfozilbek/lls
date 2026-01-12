import { describe, it, expect, vi, beforeEach } from "vitest"

import { UpdateProductUseCase } from "../../../../application/use-cases/product/update-product.use-case.js"
import { Product } from "../../../../domain/entities/product.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { ProductRepository } from "../../../../application/ports/product-repository.js"

describe("UpdateProductUseCase", () => {
    let useCase: UpdateProductUseCase
    let mockRepository: ProductRepository

    const testProduct = Product.create({
        id: "product-1",
        businessId: "business-1",
        name: "Pizza",
        description: "Delicious pizza",
        category: "Food",
        price: Money.create(50000, "UZS"),
        imageUrl: undefined,
    })

    beforeEach(() => {
        mockRepository = {
            findById: vi.fn(),
            findByBusinessId: vi.fn(),
            findAvailableByBusinessId: vi.fn(),
            findByCategory: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new UpdateProductUseCase(mockRepository)
    })

    it("should update product name", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testProduct)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("product-1", { name: "New Pizza" })

        expect(result.name).toBe("New Pizza")
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should update product price", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testProduct)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("product-1", {
            price: { amount: 60000, currency: "UZS" },
        })

        expect(result.price.amount).toBe(60000)
    })

    it("should throw if product not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("non-existent", { name: "New" })).rejects.toThrow(
            EntityNotFoundError,
        )
    })
})
