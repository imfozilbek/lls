import { describe, it, expect, vi, beforeEach } from "vitest"

import { ListBusinessesUseCase } from "../../../../application/use-cases/business/list-businesses.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { BusinessType } from "../../../../domain/enums/business-type.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { BusinessRepository } from "../../../../application/ports/business-repository.js"

describe("ListBusinessesUseCase", () => {
    let useCase: ListBusinessesUseCase
    let mockRepository: BusinessRepository

    const createBusiness = (id: string, type: BusinessType, isActive = true): Business => {
        const business = Business.create({
            id,
            name: `Business ${id}`,
            type,
            address: Address.create("Main St", "Tashkent"),
            telegramId: TelegramId.create(123456789),
        })
        if (!isActive) {
            business.deactivate()
        }
        return business
    }

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
        useCase = new ListBusinessesUseCase(mockRepository)
    })

    it("should list all businesses", async () => {
        const businesses = [
            createBusiness("1", BusinessType.FOOD),
            createBusiness("2", BusinessType.WATER),
        ]
        vi.mocked(mockRepository.findAll).mockResolvedValue(businesses)

        const result = await useCase.execute()

        expect(result).toHaveLength(2)
        expect(mockRepository.findAll).toHaveBeenCalled()
    })

    it("should filter by type", async () => {
        const businesses = [createBusiness("1", BusinessType.FOOD)]
        vi.mocked(mockRepository.findByType).mockResolvedValue(businesses)

        const result = await useCase.execute({ type: BusinessType.FOOD })

        expect(result).toHaveLength(1)
        expect(mockRepository.findByType).toHaveBeenCalledWith(BusinessType.FOOD)
    })

    it("should filter active only", async () => {
        const businesses = [createBusiness("1", BusinessType.FOOD)]
        vi.mocked(mockRepository.findActive).mockResolvedValue(businesses)

        const result = await useCase.execute({ isActive: true })

        expect(result).toHaveLength(1)
        expect(mockRepository.findActive).toHaveBeenCalled()
    })
})
