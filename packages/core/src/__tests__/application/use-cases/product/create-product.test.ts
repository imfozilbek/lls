import { describe, it, expect, vi, beforeEach } from "vitest"

import { CreateProductUseCase } from "../../../../application/use-cases/product/create-product.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { BusinessType } from "../../../../domain/enums/business-type.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { BusinessRepository } from "../../../../application/ports/business-repository.js"
import type { ProductRepository } from "../../../../application/ports/product-repository.js"

describe("CreateProductUseCase", () => {
    let useCase: CreateProductUseCase
    let mockProductRepository: ProductRepository
    let mockBusinessRepository: BusinessRepository

    const testBusiness = Business.create({
        id: "business-1",
        name: "Test Business",
        type: BusinessType.FOOD,
        address: Address.create("Main St", "Tashkent"),
        telegramId: TelegramId.create(123456789),
    })

    beforeEach(() => {
        mockProductRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findByBusinessId: vi.fn(),
            findAvailableByBusinessId: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        mockBusinessRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findByType: vi.fn(),
            findActive: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new CreateProductUseCase(mockProductRepository, mockBusinessRepository)
    })

    it("should create product with valid input", async () => {
        vi.mocked(mockBusinessRepository.findById).mockResolvedValue(testBusiness)
        vi.mocked(mockProductRepository.save).mockResolvedValue()

        const result = await useCase.execute({
            businessId: "business-1",
            name: "Pizza Margherita",
            price: { amount: 50000, currency: "UZS" },
        })

        expect(result.name).toBe("Pizza Margherita")
        expect(result.price.amount).toBe(50000)
        expect(result.businessId).toBe("business-1")
        expect(result.isAvailable).toBe(true)
        expect(mockProductRepository.save).toHaveBeenCalled()
    })

    it("should create product with all fields", async () => {
        vi.mocked(mockBusinessRepository.findById).mockResolvedValue(testBusiness)
        vi.mocked(mockProductRepository.save).mockResolvedValue()

        const result = await useCase.execute({
            businessId: "business-1",
            name: "Pizza Margherita",
            description: "Classic Italian pizza",
            price: { amount: 50000, currency: "UZS" },
            category: "Pizza",
            imageUrl: "https://example.com/pizza.jpg",
        })

        expect(result.description).toBe("Classic Italian pizza")
        expect(result.category).toBe("Pizza")
        expect(result.imageUrl).toBe("https://example.com/pizza.jpg")
    })

    it("should throw if business not found", async () => {
        vi.mocked(mockBusinessRepository.findById).mockResolvedValue(null)

        await expect(
            useCase.execute({
                businessId: "non-existent",
                name: "Pizza",
                price: { amount: 50000, currency: "UZS" },
            }),
        ).rejects.toThrow(EntityNotFoundError)
    })
})
