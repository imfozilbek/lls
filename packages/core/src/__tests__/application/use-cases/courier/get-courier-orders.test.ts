import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetCourierOrdersUseCase } from "../../../../application/use-cases/courier/get-courier-orders.use-case.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("GetCourierOrdersUseCase", () => {
    let useCase: GetCourierOrdersUseCase
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
        useCase = new GetCourierOrdersUseCase(mockRepository)
    })

    const createOrderWithCourier = (id: string, courierId: string): Order => {
        const order = Order.create({
            id,
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
        order.assignCourier(courierId)
        return order
    }

    it("should return orders assigned to courier", async () => {
        const orders = [
            createOrderWithCourier("order-1", "courier-1"),
            createOrderWithCourier("order-2", "courier-1"),
        ]
        vi.mocked(mockRepository.findByCourierId).mockResolvedValue(orders)

        const result = await useCase.execute("courier-1")

        expect(result).toHaveLength(2)
        expect(result[0].courierId).toBe("courier-1")
        expect(mockRepository.findByCourierId).toHaveBeenCalledWith("courier-1")
    })

    it("should return empty array when courier has no orders", async () => {
        vi.mocked(mockRepository.findByCourierId).mockResolvedValue([])

        const result = await useCase.execute("courier-1")

        expect(result).toHaveLength(0)
    })
})
