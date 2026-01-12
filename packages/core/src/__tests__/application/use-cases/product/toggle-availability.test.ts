import { describe, it, expect, vi, beforeEach } from "vitest"

import { ToggleProductAvailabilityUseCase } from "../../../../application/use-cases/product/toggle-availability.use-case.js"
import { Product } from "../../../../domain/entities/product.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { ProductRepository } from "../../../../application/ports/product-repository.js"

describe("ToggleProductAvailabilityUseCase", () => {
    let useCase: ToggleProductAvailabilityUseCase
    let mockRepository: ProductRepository

    beforeEach(() => {
        mockRepository = {
            findById: vi.fn(),
            findByBusinessId: vi.fn(),
            findAvailableByBusinessId: vi.fn(),
            findByCategory: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new ToggleProductAvailabilityUseCase(mockRepository)
    })

    it("should toggle available to unavailable", async () => {
        const product = Product.create({
            id: "product-1",
            businessId: "business-1",
            name: "Pizza",
            description: "Italian pizza",
            category: "Food",
            price: Money.create(50000, "UZS"),
            imageUrl: undefined,
        })
        vi.mocked(mockRepository.findById).mockResolvedValue(product)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("product-1")

        expect(result.isAvailable).toBe(false)
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should toggle unavailable to available", async () => {
        const product = Product.create({
            id: "product-1",
            businessId: "business-1",
            name: "Pizza",
            description: "Italian pizza",
            category: "Food",
            price: Money.create(50000, "UZS"),
            imageUrl: undefined,
        })
        product.markUnavailable()
        vi.mocked(mockRepository.findById).mockResolvedValue(product)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("product-1")

        expect(result.isAvailable).toBe(true)
    })

    it("should throw if product not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("non-existent")).rejects.toThrow(EntityNotFoundError)
    })
})
