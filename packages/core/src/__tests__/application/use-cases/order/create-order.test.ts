import { describe, it, expect, vi, beforeEach } from "vitest"

import { CreateOrderUseCase } from "../../../../application/use-cases/order/create-order.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { Customer } from "../../../../domain/entities/customer.js"
import { BusinessType } from "../../../../domain/enums/business-type.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { BusinessRuleViolationError } from "../../../../domain/errors/business-rule.error.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { BusinessRepository } from "../../../../application/ports/business-repository.js"
import type { CustomerRepository } from "../../../../application/ports/customer-repository.js"
import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("CreateOrderUseCase", () => {
    let useCase: CreateOrderUseCase
    let orderRepo: OrderRepository
    let customerRepo: CustomerRepository
    let businessRepo: BusinessRepository

    beforeEach(() => {
        orderRepo = {
            findById: vi.fn(),
            findByCustomerId: vi.fn(),
            findByBusinessId: vi.fn(),
            findByCourierId: vi.fn(),
            findByStatus: vi.fn(),
            findPendingByBusinessId: vi.fn(),
            findAvailableForCourier: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        customerRepo = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        businessRepo = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findByType: vi.fn(),
            findActive: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new CreateOrderUseCase(orderRepo, customerRepo, businessRepo)
    })

    const createCustomer = (): Customer => {
        return Customer.create({
            id: "cust-1",
            telegramId: TelegramId.create(123456789),
            name: "John",
            phone: Phone.create("+998901234567"),
            address: Address.create("Main St", "Tashkent"),
        })
    }

    const createBusiness = (isActive = true): Business => {
        const business = Business.create({
            id: "biz-1",
            name: "Test Business",
            type: BusinessType.FOOD,
            address: Address.create("Main St", "Tashkent"),
            telegramId: TelegramId.create(987654321),
        })
        if (!isActive) {
            business.deactivate()
        }
        return business
    }

    it("should create order with valid input", async () => {
        vi.mocked(customerRepo.findById).mockResolvedValue(createCustomer())
        vi.mocked(businessRepo.findById).mockResolvedValue(createBusiness())
        vi.mocked(orderRepo.save).mockResolvedValue()

        const result = await useCase.execute({
            customerId: "cust-1",
            businessId: "biz-1",
            items: [
                {
                    productId: "prod-1",
                    productName: "Pizza",
                    quantity: 2,
                    unitPrice: { amount: 50000, currency: "UZS" },
                },
            ],
            deliveryAddress: { street: "Delivery St", city: "Tashkent" },
        })

        expect(result.status).toBe(OrderStatus.PENDING)
        expect(result.total.amount).toBe(100000)
        expect(orderRepo.save).toHaveBeenCalled()
    })

    it("should throw when customer not found", async () => {
        vi.mocked(customerRepo.findById).mockResolvedValue(null)

        await expect(
            useCase.execute({
                customerId: "not-found",
                businessId: "biz-1",
                items: [
                    {
                        productId: "prod-1",
                        productName: "Pizza",
                        quantity: 1,
                        unitPrice: { amount: 50000, currency: "UZS" },
                    },
                ],
                deliveryAddress: { street: "St", city: "City" },
            }),
        ).rejects.toThrow(EntityNotFoundError)
    })

    it("should throw when business not active", async () => {
        vi.mocked(customerRepo.findById).mockResolvedValue(createCustomer())
        vi.mocked(businessRepo.findById).mockResolvedValue(createBusiness(false))

        await expect(
            useCase.execute({
                customerId: "cust-1",
                businessId: "biz-1",
                items: [
                    {
                        productId: "prod-1",
                        productName: "Pizza",
                        quantity: 1,
                        unitPrice: { amount: 50000, currency: "UZS" },
                    },
                ],
                deliveryAddress: { street: "St", city: "City" },
            }),
        ).rejects.toThrow(BusinessRuleViolationError)
    })
})
