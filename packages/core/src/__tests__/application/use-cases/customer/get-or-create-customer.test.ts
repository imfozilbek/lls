import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetOrCreateCustomerUseCase } from "../../../../application/use-cases/customer/get-or-create-customer.use-case.js"
import { Customer } from "../../../../domain/entities/customer.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { CustomerRepository } from "../../../../application/ports/customer-repository.js"

describe("GetOrCreateCustomerUseCase", () => {
    let useCase: GetOrCreateCustomerUseCase
    let mockRepository: CustomerRepository

    const existingCustomer = Customer.create({
        id: "customer-1",
        telegramId: TelegramId.create(123456789),
        name: "John Doe",
        phone: Phone.create("+998901234567"),
        address: Address.create("Main St", "Tashkent"),
    })

    beforeEach(() => {
        mockRepository = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new GetOrCreateCustomerUseCase(mockRepository)
    })

    it("should return existing customer", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(existingCustomer)

        const result = await useCase.execute({
            telegramId: 123456789,
            firstName: "John",
        })

        expect(result.id).toBe("customer-1")
        expect(result.name).toBe("John Doe")
        expect(mockRepository.save).not.toHaveBeenCalled()
    })

    it("should create new customer when not found", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute({
            telegramId: 987654321,
            firstName: "Jane",
        })

        expect(result.name).toBe("Jane")
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should create customer with full name when lastName provided", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute({
            telegramId: 987654321,
            firstName: "Jane",
            lastName: "Smith",
        })

        expect(result.name).toBe("Jane Smith")
    })

    it("should set default address for new customer", async () => {
        vi.mocked(mockRepository.findByTelegramId).mockResolvedValue(null)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute({
            telegramId: 987654321,
            firstName: "Jane",
        })

        expect(result.address.street).toBe("Not set")
        expect(result.address.city).toBe("Tashkent")
    })
})
