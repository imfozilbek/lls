import { describe, it, expect, vi, beforeEach } from "vitest"

import { CreateBusinessUseCase } from "../../../../application/use-cases/business/create-business.use-case.js"
import { BusinessType } from "../../../../domain/enums/business-type.js"

import type { BusinessRepository } from "../../../../application/ports/business-repository.js"

describe("CreateBusinessUseCase", () => {
    let useCase: CreateBusinessUseCase
    let mockRepository: BusinessRepository

    beforeEach(() => {
        mockRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findByType: vi.fn(),
            findActive: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new CreateBusinessUseCase(mockRepository)
    })

    it("should create business with valid input", async () => {
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute({
            name: "New Business",
            type: BusinessType.FOOD,
            address: { street: "Main St", city: "Tashkent" },
            telegramId: 123456789,
        })

        expect(result.name).toBe("New Business")
        expect(result.type).toBe(BusinessType.FOOD)
        expect(result.isActive).toBe(true)
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should create business with coordinates", async () => {
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute({
            name: "New Business",
            type: BusinessType.WATER,
            address: {
                street: "Main St",
                city: "Tashkent",
                latitude: 41.2995,
                longitude: 69.2401,
            },
            telegramId: 123456789,
        })

        expect(result.address.latitude).toBe(41.2995)
        expect(result.address.longitude).toBe(69.2401)
    })
})
