import { describe, it, expect, vi, beforeEach } from "vitest"

import { CompleteDeliveryUseCase } from "../../../../application/use-cases/courier/complete-delivery.use-case.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("CompleteDeliveryUseCase", () => {
    let useCase: CompleteDeliveryUseCase
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
        useCase = new CompleteDeliveryUseCase(mockRepository)
    })

    const createPickedUpOrder = (): Order => {
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
        order.accept()
        order.startPreparing()
        order.markReady()
        order.assignCourier("courier-1")
        order.pickup()
        return order
    }

    it("should complete delivery successfully", async () => {
        const order = createPickedUpOrder()
        vi.mocked(mockRepository.findById).mockResolvedValue(order)
        vi.mocked(mockRepository.save).mockResolvedValue()

        const result = await useCase.execute("order-1")

        expect(result.status).toBe(OrderStatus.DELIVERED)
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should throw if order not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("non-existent")).rejects.toThrow(EntityNotFoundError)
    })
})
