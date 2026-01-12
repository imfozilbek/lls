import { describe, it, expect, vi, beforeEach } from "vitest"

import { TakeOrderUseCase } from "../../../../application/use-cases/courier/take-order.use-case.js"
import { Courier } from "../../../../domain/entities/courier.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { BusinessRuleViolationError } from "../../../../domain/errors/business-rule.error.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { CourierRepository } from "../../../../application/ports/courier-repository.js"
import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("TakeOrderUseCase", () => {
    let useCase: TakeOrderUseCase
    let orderRepo: OrderRepository
    let courierRepo: CourierRepository

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
        courierRepo = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findAvailable: vi.fn(),
            findActive: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }
        useCase = new TakeOrderUseCase(orderRepo, courierRepo)
    })

    const createOrder = (): Order => {
        return Order.create({
            id: "order-1",
            customerId: "cust-1",
            businessId: "biz-1",
            items: [
                OrderItem.create({
                    id: "item-1",
                    productId: "prod-1",
                    productName: "Pizza",
                    quantity: 1,
                    unitPrice: Money.create(50000),
                }),
            ],
            deliveryAddress: Address.create("Main St", "Tashkent"),
        })
    }

    const createCourier = (available = true): Courier => {
        const courier = Courier.create({
            id: "courier-1",
            telegramId: TelegramId.create(123456789),
            name: "John Courier",
            phone: Phone.create("+998901234567"),
        })
        if (!available) {
            courier.goOffline()
        }
        return courier
    }

    it("should assign courier to order", async () => {
        vi.mocked(orderRepo.findById).mockResolvedValue(createOrder())
        vi.mocked(courierRepo.findById).mockResolvedValue(createCourier())
        vi.mocked(orderRepo.save).mockResolvedValue()

        const result = await useCase.execute("order-1", "courier-1")

        expect(result.courierId).toBe("courier-1")
        expect(orderRepo.save).toHaveBeenCalled()
    })

    it("should throw when order not found", async () => {
        vi.mocked(orderRepo.findById).mockResolvedValue(null)

        await expect(useCase.execute("not-found", "courier-1")).rejects.toThrow(EntityNotFoundError)
    })

    it("should throw when courier not available", async () => {
        vi.mocked(orderRepo.findById).mockResolvedValue(createOrder())
        vi.mocked(courierRepo.findById).mockResolvedValue(createCourier(false))

        await expect(useCase.execute("order-1", "courier-1")).rejects.toThrow(
            BusinessRuleViolationError,
        )
    })

    it("should throw when order already has courier", async () => {
        const order = createOrder()
        order.assignCourier("other-courier")
        vi.mocked(orderRepo.findById).mockResolvedValue(order)
        vi.mocked(courierRepo.findById).mockResolvedValue(createCourier())

        await expect(useCase.execute("order-1", "courier-1")).rejects.toThrow(
            BusinessRuleViolationError,
        )
    })
})
