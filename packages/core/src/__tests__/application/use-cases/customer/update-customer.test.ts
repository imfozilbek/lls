import { describe, it, expect, vi, beforeEach } from "vitest"

import { UpdateCustomerUseCase } from "../../../../application/use-cases/customer/update-customer.use-case.js"
import { Customer } from "../../../../domain/entities/customer.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { CustomerRepository } from "../../../../application/ports/customer-repository.js"

describe("UpdateCustomerUseCase", () => {
    let useCase: UpdateCustomerUseCase
    let mockRepository: CustomerRepository

    const testCustomer = Customer.create({
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
        useCase = new UpdateCustomerUseCase(mockRepository)
    })

    it("should update customer name", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testCustomer)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("customer-1", { name: "Jane Doe" })

        expect(result.name).toBe("Jane Doe")
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should update customer phone", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testCustomer)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("customer-1", { phone: "+998909876543" })

        expect(result.phone).toBe("+998 90 987 65 43")
    })

    it("should update customer address", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testCustomer)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("customer-1", {
            address: { street: "New Street", city: "Samarkand" },
        })

        expect(result.address.street).toBe("New Street")
        expect(result.address.city).toBe("Samarkand")
    })

    it("should update address with coordinates", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testCustomer)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("customer-1", {
            address: {
                street: "Geo Street",
                city: "Tashkent",
                latitude: 41.311081,
                longitude: 69.240562,
            },
        })

        expect(result.address.latitude).toBe(41.311081)
    })

    it("should throw if customer not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("non-existent", { name: "Test" })).rejects.toThrow(
            EntityNotFoundError,
        )
    })
})
