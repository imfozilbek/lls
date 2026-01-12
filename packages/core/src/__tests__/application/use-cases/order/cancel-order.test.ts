import { describe, it, expect, vi, beforeEach } from "vitest"

import { CancelOrderUseCase } from "../../../../application/use-cases/order/cancel-order.use-case.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("CancelOrderUseCase", () => {
    let useCase: CancelOrderUseCase
    let mockRepository: OrderRepository

    beforeEach(() => {
        mockRepository = {
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
        useCase = new CancelOrderUseCase(mockRepository)
    })

    it("should cancel pending order", async () => {
        const order = Order.create({
            id: "order-1",
            customerId: "customer-1",
            businessId: "business-1",
            items: [
                OrderItem.create({
                    productId: "product-1",
                    productName: "Pizza",
                    quantity: 1,
                    unitPrice: Money.create(50000, "UZS"),
                }),
            ],
            deliveryAddress: Address.create("Main St", "Tashkent"),
            status: OrderStatus.PENDING,
        })
        vi.mocked(mockRepository.findById).mockResolvedValue(order)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute({ orderId: "order-1" })

        expect(result.status).toBe(OrderStatus.CANCELLED)
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should cancel order with reason", async () => {
        const order = Order.create({
            id: "order-1",
            customerId: "customer-1",
            businessId: "business-1",
            items: [
                OrderItem.create({
                    productId: "product-1",
                    productName: "Pizza",
                    quantity: 1,
                    unitPrice: Money.create(50000, "UZS"),
                }),
            ],
            deliveryAddress: Address.create("Main St", "Tashkent"),
            status: OrderStatus.PENDING,
        })
        vi.mocked(mockRepository.findById).mockResolvedValue(order)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute({
            orderId: "order-1",
            reason: "Changed my mind",
        })

        expect(result.status).toBe(OrderStatus.CANCELLED)
    })

    it("should throw if order not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute({ orderId: "non-existent" })).rejects.toThrow(
            EntityNotFoundError,
        )
    })
})
