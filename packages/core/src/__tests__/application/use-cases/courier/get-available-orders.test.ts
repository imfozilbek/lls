import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetAvailableOrdersUseCase } from "../../../../application/use-cases/courier/get-available-orders.use-case.js"
import { Order } from "../../../../domain/entities/order.js"
import { OrderItem } from "../../../../domain/entities/order-item.js"
import { OrderStatus } from "../../../../domain/enums/order-status.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Money } from "../../../../domain/value-objects/money.js"

import type { OrderRepository } from "../../../../application/ports/order-repository.js"

describe("GetAvailableOrdersUseCase", () => {
    let useCase: GetAvailableOrdersUseCase
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
        useCase = new GetAvailableOrdersUseCase(mockRepository)
    })

    const createReadyOrder = (id: string): Order => {
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
        return order
    }

    it("should return available orders for couriers", async () => {
        const orders = [createReadyOrder("order-1"), createReadyOrder("order-2")]
        vi.mocked(mockRepository.findAvailableForCourier).mockResolvedValue(orders)

        const result = await useCase.execute()

        expect(result).toHaveLength(2)
        expect(result[0].status).toBe(OrderStatus.READY)
        expect(mockRepository.findAvailableForCourier).toHaveBeenCalled()
    })

    it("should return empty array when no orders available", async () => {
        vi.mocked(mockRepository.findAvailableForCourier).mockResolvedValue([])

        const result = await useCase.execute()

        expect(result).toHaveLength(0)
    })
})
