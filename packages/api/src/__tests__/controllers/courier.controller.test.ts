import "reflect-metadata"
import { OrderStatus } from "@lls/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CourierController } from "../../modules/courier/courier.controller.js"

import type { CourierDTO, OrderDTO } from "@lls/core"
import type { CourierService } from "../../modules/courier/courier.service.js"

describe("CourierController", () => {
    let controller: CourierController
    let mockService: {
        getAvailable: ReturnType<typeof vi.fn>
        take: ReturnType<typeof vi.fn>
        complete: ReturnType<typeof vi.fn>
        getOrders: ReturnType<typeof vi.fn>
        getByTelegramId: ReturnType<typeof vi.fn>
    }

    const mockCourier: CourierDTO = {
        id: "courier-1",
        name: "Test Courier",
        phone: "+998901234567",
        telegramId: 123456789,
        isAvailable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }

    const mockOrder: OrderDTO = {
        id: "order-1",
        customerId: "customer-1",
        businessId: "business-1",
        courierId: "courier-1",
        items: [
            {
                id: "item-1",
                productId: "product-1",
                productName: "Pizza",
                quantity: 1,
                unitPrice: { amount: 50000, currency: "UZS" },
                total: { amount: 50000, currency: "UZS" },
            },
        ],
        deliveryAddress: { street: "Main St", city: "Tashkent" },
        status: OrderStatus.READY,
        total: { amount: 50000, currency: "UZS" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }

    beforeEach(() => {
        mockService = {
            getAvailable: vi.fn(),
            take: vi.fn(),
            complete: vi.fn(),
            getOrders: vi.fn(),
            getByTelegramId: vi.fn().mockResolvedValue(mockCourier),
        }

        controller = new CourierController(mockService as unknown as CourierService)
    })

    describe("getAvailableOrders", () => {
        it("should return available orders for couriers", async () => {
            mockService.getAvailable.mockResolvedValue([mockOrder])

            const result = await controller.getAvailableOrders()

            expect(result).toHaveLength(1)
            expect(mockService.getAvailable).toHaveBeenCalled()
        })
    })

    describe("takeOrder", () => {
        it("should assign courier to order", async () => {
            mockService.take.mockResolvedValue(mockOrder)

            const result = await controller.takeOrder("order-1", { id: 123456789 } as never)

            expect(result.courierId).toBe("courier-1")
            expect(mockService.getByTelegramId).toHaveBeenCalledWith(123456789)
            expect(mockService.take).toHaveBeenCalledWith("order-1", "courier-1")
        })
    })

    describe("completeDelivery", () => {
        it("should mark order as delivered", async () => {
            const delivered = { ...mockOrder, status: OrderStatus.DELIVERED }
            mockService.complete.mockResolvedValue(delivered)

            const result = await controller.completeDelivery("order-1", { id: 123456789 } as never)

            expect(result.status).toBe(OrderStatus.DELIVERED)
            expect(mockService.getByTelegramId).toHaveBeenCalledWith(123456789)
            expect(mockService.complete).toHaveBeenCalledWith("order-1", "courier-1")
        })
    })

    describe("getMyOrders", () => {
        it("should return orders assigned to authenticated courier", async () => {
            mockService.getOrders.mockResolvedValue([mockOrder])

            const result = await controller.getMyOrders({ id: 123456789 } as never)

            expect(result).toHaveLength(1)
            expect(mockService.getByTelegramId).toHaveBeenCalledWith(123456789)
            expect(mockService.getOrders).toHaveBeenCalledWith("courier-1")
        })
    })
})
