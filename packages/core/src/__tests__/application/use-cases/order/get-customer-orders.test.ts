import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetCustomerOrdersUseCase } from "../../../../application/use-cases/order/get-customer-orders.use-case.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("GetCustomerOrdersUseCase", () => {
    let useCase: GetCustomerOrdersUseCase
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
            status: OrderStatus.DELIVERED,
        }),
        Order.create({
            id: "order-2",
            customerId: "customer-1",
            businessId: "business-1",
            items: [
                OrderItem.create({
                    productId: "product-2",
                    productName: "Pasta",
                    quantity: 2,
                    unitPrice: Money.create(40000, "UZS"),
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
        useCase = new GetCustomerOrdersUseCase(mockRepository)
    })

    it("should return customer orders", async () => {
        vi.mocked(mockRepository.findByCustomerId).mockResolvedValue(testOrders)

        const result = await useCase.execute("customer-1")

        expect(result).toHaveLength(2)
        expect(result[0].customerId).toBe("customer-1")
        expect(mockRepository.findByCustomerId).toHaveBeenCalledWith("customer-1")
    })

    it("should return empty array when no orders", async () => {
        vi.mocked(mockRepository.findByCustomerId).mockResolvedValue([])

        const result = await useCase.execute("customer-1")

        expect(result).toHaveLength(0)
    })
})
