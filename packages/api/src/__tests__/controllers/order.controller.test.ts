import "reflect-metadata"
import { OrderStatus } from "@lls/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { OrderController } from "../../modules/order/order.controller.js"

import type { OrderDTO } from "@lls/core"
import type { OrderService } from "../../modules/order/order.service.js"

describe("OrderController", () => {
    let controller: OrderController
    let mockService: {
        create: ReturnType<typeof vi.fn>
        getById: ReturnType<typeof vi.fn>
        getByCustomer: ReturnType<typeof vi.fn>
        getByBusiness: ReturnType<typeof vi.fn>
        updateStatus: ReturnType<typeof vi.fn>
        cancel: ReturnType<typeof vi.fn>
    }

    const mockOrder: OrderDTO = {
        id: "order-1",
        customerId: "customer-1",
        businessId: "business-1",
        courierId: undefined,
        items: [
            {
                id: "item-1",
                productId: "product-1",
                productName: "Pizza",
                quantity: 2,
                unitPrice: { amount: 50000, currency: "UZS" },
                total: { amount: 100000, currency: "UZS" },
            },
        ],
        deliveryAddress: { street: "Main St", city: "Tashkent" },
        status: OrderStatus.PENDING,
        total: { amount: 100000, currency: "UZS" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }

    beforeEach(() => {
        mockService = {
            create: vi.fn(),
            getById: vi.fn(),
            getByCustomer: vi.fn(),
            getByBusiness: vi.fn(),
            updateStatus: vi.fn(),
            cancel: vi.fn(),
        }

        controller = new OrderController(mockService as unknown as OrderService)
    })

    describe("create", () => {
        it("should create order", async () => {
            mockService.create.mockResolvedValue(mockOrder)

            const input = {
                customerId: "customer-1",
                businessId: "business-1",
                items: [{ productId: "product-1", quantity: 2 }],
                deliveryAddress: { street: "Main St", city: "Tashkent" },
            }

            const result = await controller.create(input)

            expect(result.id).toBe("order-1")
            expect(mockService.create).toHaveBeenCalledWith(input)
        })
    })

    describe("getById", () => {
        it("should return order by id", async () => {
            mockService.getById.mockResolvedValue(mockOrder)

            const result = await controller.getById("order-1")

            expect(result.id).toBe("order-1")
            expect(mockService.getById).toHaveBeenCalledWith("order-1")
        })
    })

    describe("getByCustomer", () => {
        it("should return customer orders", async () => {
            mockService.getByCustomer.mockResolvedValue([mockOrder])

            const result = await controller.getByCustomer("customer-1")

            expect(result).toHaveLength(1)
            expect(mockService.getByCustomer).toHaveBeenCalledWith("customer-1")
        })
    })

    describe("getByBusiness", () => {
        it("should return business orders", async () => {
            mockService.getByBusiness.mockResolvedValue([mockOrder])

            const result = await controller.getByBusiness("business-1")

            expect(result).toHaveLength(1)
            expect(mockService.getByBusiness).toHaveBeenCalledWith("business-1", undefined)
        })

        it("should filter by status", async () => {
            mockService.getByBusiness.mockResolvedValue([mockOrder])

            await controller.getByBusiness("business-1", OrderStatus.PENDING)

            expect(mockService.getByBusiness).toHaveBeenCalledWith(
                "business-1",
                OrderStatus.PENDING,
            )
        })
    })

    describe("updateStatus", () => {
        it("should update order status", async () => {
            const updated = { ...mockOrder, status: OrderStatus.ACCEPTED }
            mockService.updateStatus.mockResolvedValue(updated)

            const result = await controller.updateStatus("order-1", {
                status: OrderStatus.ACCEPTED,
            })

            expect(result.status).toBe(OrderStatus.ACCEPTED)
            expect(mockService.updateStatus).toHaveBeenCalledWith("order-1", OrderStatus.ACCEPTED)
        })
    })

    describe("cancel", () => {
        it("should cancel order", async () => {
            const cancelled = { ...mockOrder, status: OrderStatus.CANCELLED }
            mockService.cancel.mockResolvedValue(cancelled)

            const result = await controller.cancel("order-1", "Changed mind")

            expect(result.status).toBe(OrderStatus.CANCELLED)
            expect(mockService.cancel).toHaveBeenCalledWith("order-1", "Changed mind")
        })
    })
})
