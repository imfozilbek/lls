import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetBusinessUseCase } from "../../../../application/use-cases/business/get-business.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { BusinessType } from "../../../../domain/enums/business-type.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { BusinessRepository } from "../../../../application/ports/business-repository.js"

describe("GetBusinessUseCase", () => {
    let useCase: GetBusinessUseCase
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
        useCase = new GetBusinessUseCase(mockRepository)
    })

    it("should return business when found", async () => {
        const business = createBusiness()
        vi.mocked(mockRepository.findById).mockResolvedValue(business)

        const result = await useCase.execute("biz-1")

        expect(result.id).toBe("biz-1")
        expect(result.name).toBe("Test Business")
    })

    it("should throw when business not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("not-found")).rejects.toThrow(EntityNotFoundError)
    })
})
