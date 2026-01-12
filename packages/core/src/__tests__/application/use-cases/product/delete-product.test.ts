import { describe, it, expect, vi, beforeEach } from "vitest"

import { DeleteProductUseCase } from "../../../../application/use-cases/product/delete-product.use-case.js"
import { Product } from "../../../../domain/entities/product.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { ProductRepository } from "../../../../application/ports/product-repository.js"

describe("DeleteProductUseCase", () => {
    let useCase: DeleteProductUseCase
    let mockRepository: ProductRepository

    const testProduct = Product.create({
        id: "product-1",
        businessId: "business-1",
        name: "Pizza",
        price: Money.create(50000, "UZS"),
    })

    beforeEach(() => {
        mockRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findByBusinessId: vi.fn(),
            findAvailableByBusinessId: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new DeleteProductUseCase(mockRepository)
    })

    it("should delete existing product", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testProduct)
        vi.mocked(mockRepository.delete).mockResolvedValue()

        await useCase.execute("product-1")

        expect(mockRepository.delete).toHaveBeenCalledWith("product-1")
    })

    it("should throw if product not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("non-existent")).rejects.toThrow(EntityNotFoundError)
    })
})
