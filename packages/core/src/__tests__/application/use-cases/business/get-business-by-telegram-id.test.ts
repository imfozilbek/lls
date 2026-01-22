import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetBusinessByTelegramIdUseCase } from "../../../../application/use-cases/business/get-business-by-telegram-id.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { BusinessType } from "../../../../domain/enums/business-type.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { BusinessRepository } from "../../../../application/ports/business-repository.js"

describe("GetBusinessByTelegramIdUseCase", () => {
    let useCase: GetBusinessByTelegramIdUseCase
    let mockRepository: BusinessRepository

    const createBusiness = (): Business => {
        return Business.create({
            id: "biz-1",
            name: "Test Business",
            type: BusinessType.FOOD,
            address: Address.create("Main St", "Tashkent"),
            telegramId: TelegramId.create(123456789),
        })
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
        useCase = new GetBusinessByTelegramIdUseCase(mockRepository)
    })

    it("should return business when found by telegram id", async () => {
        const business = createBusiness()
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(business)

        const result = await useCase.execute(123456789)

        expect(result.id).toBe("biz-1")
        expect(result.telegramId).toBe(123456789)
        expect(mockRepository.findByTelegramId).toHaveBeenCalledWith(123456789)
    })

    it("should throw EntityNotFoundError when business not found", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)

        await expect(useCase.execute(999999999)).rejects.toThrow(EntityNotFoundError)
    })

    it("should include telegram id in error message", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)

        await expect(useCase.execute(999999999)).rejects.toThrow("telegram:999999999")
    })
})
