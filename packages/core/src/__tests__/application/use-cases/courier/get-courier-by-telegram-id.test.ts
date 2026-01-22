import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetCourierByTelegramIdUseCase } from "../../../../application/use-cases/courier/get-courier-by-telegram-id.use-case.js"
import { Courier } from "../../../../domain/entities/courier.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { CourierRepository } from "../../../../application/ports/courier-repository.js"

describe("GetCourierByTelegramIdUseCase", () => {
    let useCase: GetCourierByTelegramIdUseCase
    let mockRepository: CourierRepository

    const createCourier = (): Courier => {
        return Courier.create({
            id: "courier-1",
            name: "Test Courier",
            telegramId: TelegramId.create(123456789),
            phone: Phone.create("+998901234567"),
        })
    }

    beforeEach(() => {
        mockRepository = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findAvailable: vi.fn(),
            findActive: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new GetCourierByTelegramIdUseCase(mockRepository)
    })

    it("should return courier when found by telegram id", async () => {
        const courier = createCourier()
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(courier)

        const result = await useCase.execute(123456789)

        expect(result.id).toBe("courier-1")
        expect(result.telegramId).toBe(123456789)
        expect(mockRepository.findByTelegramId).toHaveBeenCalledWith(123456789)
    })

    it("should throw EntityNotFoundError when courier not found", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)

        await expect(useCase.execute(999999999)).rejects.toThrow(EntityNotFoundError)
    })

    it("should include telegram id in error message", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)

        await expect(useCase.execute(999999999)).rejects.toThrow("telegram:999999999")
    })
})
