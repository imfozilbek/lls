import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetBusinessOrdersUseCase } from "../../../../application/use-cases/order/get-business-orders.use-case.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("GetBusinessOrdersUseCase", () => {
    let useCase: GetBusinessOrdersUseCase
    let mockRepository: OrderRepository

    const testOrders = [
        Order.create({
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
        }),
    ]

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
        useCase = new GetBusinessOrdersUseCase(mockRepository)
    })

    it("should return all business orders", async () => {
        vi.mocked(mockRepository.findByBusinessId).mockResolvedValue(testOrders)

        const result = await useCase.execute({ businessId: "business-1" })

        expect(result).toHaveLength(1)
        expect(result[0].businessId).toBe("business-1")
    })

    it("should filter by status when provided", async () => {
        vi.mocked(mockRepository.findByBusinessId).mockResolvedValue(testOrders)

        const result = await useCase.execute({
            businessId: "business-1",
            status: OrderStatus.PENDING,
        })

        expect(result).toHaveLength(1)
        expect(result[0].status).toBe(OrderStatus.PENDING)
    })
})
