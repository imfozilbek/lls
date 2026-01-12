import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetOrderUseCase } from "../../../../application/use-cases/order/get-order.use-case.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("GetOrderUseCase", () => {
    let useCase: GetOrderUseCase
    let mockRepository: OrderRepository

    const testOrder = Order.create({
        id: "order-1",
        customerId: "customer-1",
        businessId: "business-1",
        items: [
            OrderItem.create({
                productId: "product-1",
                productName: "Pizza",
                quantity: 2,
                unitPrice: Money.create(50000, "UZS"),
            }),
        ],
        deliveryAddress: Address.create("Main St", "Tashkent"),
        status: OrderStatus.PENDING,
    })

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
        useCase = new GetOrderUseCase(mockRepository)
    })

    it("should return order by id", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(testOrder)

        const result = await useCase.execute("order-1")

        expect(result.id).toBe("order-1")
        expect(result.customerId).toBe("customer-1")
        expect(result.items).toHaveLength(1)
        expect(result.total.amount).toBe(100000)
    })

    it("should throw if order not found", async () => {
        vi.mocked(mockRepository.findById).mockResolvedValue(null)

        await expect(useCase.execute("non-existent")).rejects.toThrow(EntityNotFoundError)
    })
})
