import { describe, it, expect, vi, beforeEach } from "vitest"

import { UpdateBusinessUseCase } from "../../../../application/use-cases/business/update-business.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { BusinessType } from "../../../../domain/enums/business-type.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { BusinessRepository } from "../../../../application/ports/business-repository.js"

describe("UpdateBusinessUseCase", () => {
    let useCase: UpdateBusinessUseCase
    let mockRepository: BusinessRepository

    const testBusiness = Business.create({
        id: "business-1",
        telegramId: TelegramId.create(123456789),
        name: "Pizza Place",
        type: BusinessType.FOOD,
        address: Address.create("Main St", "Tashkent"),
    })

    beforeEach(() => {
        mockRepository = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findByType: vi.fn(),
            findAll: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new UpdateBusinessUseCase(mockRepository)
    })

    it("should update business name", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testBusiness)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("business-1", { name: "New Pizza Place" })

        expect(result.name).toBe("New Pizza Place")
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should update business address", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testBusiness)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("business-1", {
            address: { street: "New Street", city: "Samarkand" },
        })

        expect(result.address.street).toBe("New Street")
        expect(result.address.city).toBe("Samarkand")
    })

    it("should update address with coordinates", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testBusiness)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("business-1", {
            address: {
                street: "Geo Street",
                city: "Tashkent",
                latitude: 41.311081,
                longitude: 69.240562,
            },
        })

        expect(result.address.street).toBe("Geo Street")
        expect(result.address.latitude).toBe(41.311081)
    })

    it("should throw if business not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("non-existent", { name: "Test" })).rejects.toThrow(
            EntityNotFoundError,
        )
    })
})
