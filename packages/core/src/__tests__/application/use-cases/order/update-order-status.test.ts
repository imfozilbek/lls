import { describe, it, expect, vi, beforeEach } from "vitest"

import { UpdateOrderStatusUseCase } from "../../../../application/use-cases/order/update-order-status.use-case.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("UpdateOrderStatusUseCase", () => {
    let useCase: UpdateOrderStatusUseCase
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
        useCase = new UpdateOrderStatusUseCase(mockRepository)
    })

    it("should update order status from PENDING to ACCEPTED", async () => {
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

        const result = await useCase.execute("order-1", OrderStatus.ACCEPTED)

        expect(result.status).toBe(OrderStatus.ACCEPTED)
        expect(mockRepository.save).toHaveBeenCalled()
    })

    it("should throw if order not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("non-existent", OrderStatus.ACCEPTED)).rejects.toThrow(
            EntityNotFoundError,
        )
    })
})
