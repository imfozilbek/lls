import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetCustomerByTelegramIdUseCase } from "../../../../application/use-cases/customer/get-customer-by-telegram-id.use-case.js"
import { Customer } from "../../../../domain/entities/customer.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { CustomerRepository } from "../../../../application/ports/customer-repository.js"

describe("GetCustomerByTelegramIdUseCase", () => {
    let useCase: GetCustomerByTelegramIdUseCase
    let mockRepository: CustomerRepository

    const createCustomer = (): Customer => {
        return Customer.create({
            id: "cust-1",
            name: "Test Customer",
            telegramId: TelegramId.create(123456789),
            phone: Phone.create("+998901234567"),
            address: Address.create("Main St", "Tashkent"),
        })
    }

    beforeEach(() => {
        mockRepository = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new GetCustomerByTelegramIdUseCase(mockRepository)
    })

    it("should return customer when found by telegram id", async () => {
        const customer = createCustomer()
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(customer)

        const result = await useCase.execute(123456789)

        expect(result.id).toBe("cust-1")
        expect(result.telegramId).toBe(123456789)
        expect(mockRepository.findByTelegramId).toHaveBeenCalledWith(123456789)
    })

    it("should throw EntityNotFoundError when customer not found", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)

        await expect(useCase.execute(999999999)).rejects.toThrow(EntityNotFoundError)
    })

    it("should include telegram id in error message", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)

        await expect(useCase.execute(999999999)).rejects.toThrow("telegram:999999999")
    })
})
