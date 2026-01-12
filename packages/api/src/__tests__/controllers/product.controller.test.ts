import "reflect-metadata"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ProductController } from "../../modules/product/product.controller.js"

import type { ProductDTO } from "@lls/core"
import type { ProductService } from "../../modules/product/product.service.js"

describe("ProductController", () => {
    let controller: ProductController
    let mockService: {
        listByBusiness: ReturnType<typeof vi.fn>
        create: ReturnType<typeof vi.fn>
        update: ReturnType<typeof vi.fn>
        delete: ReturnType<typeof vi.fn>
        toggle: ReturnType<typeof vi.fn>
    }

    const mockProduct: ProductDTO = {
        id: "product-1",
        businessId: "business-1",
        name: "Pizza Margherita",
        description: "Italian pizza",
        price: { amount: 50000, currency: "UZS" },
        category: "Pizza",
        imageUrl: undefined,
        isAvailable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }

    beforeEach(() => {
        mockService = {
            listByBusiness: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            toggle: vi.fn(),
        }

        controller = new ProductController(mockService as unknown as ProductService)
    })

    describe("listByBusiness", () => {
        it("should return products for business", async () => {
            mockService.listByBusiness.mockResolvedValue([mockProduct])

            const result = await controller.listByBusiness("business-1")

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe("Pizza Margherita")
            expect(mockService.listByBusiness).toHaveBeenCalledWith("business-1")
        })
    })

    describe("create", () => {
        it("should create product", async () => {
            mockService.create.mockResolvedValue(mockProduct)

            const input = {
                name: "Pizza Margherita",
                description: "Italian pizza",
                price: { amount: 50000, currency: "UZS" },
                category: "Pizza",
            }

            const result = await controller.create("business-1", input)

            expect(result.name).toBe("Pizza Margherita")
            expect(mockService.create).toHaveBeenCalledWith({ ...input, businessId: "business-1" })
        })
    })

    describe("update", () => {
        it("should update product", async () => {
            const updated = { ...mockProduct, name: "Updated Pizza" }
            mockService.update.mockResolvedValue(updated)

            const result = await controller.update("product-1", { name: "Updated Pizza" })

            expect(result.name).toBe("Updated Pizza")
            expect(mockService.update).toHaveBeenCalledWith("product-1", { name: "Updated Pizza" })
        })
    })

    describe("delete", () => {
        it("should delete product", async () => {
            mockService.delete.mockResolvedValue(undefined)

            await controller.delete("product-1")

            expect(mockService.delete).toHaveBeenCalledWith("product-1")
        })
    })

    describe("toggleAvailability", () => {
        it("should toggle product availability", async () => {
            const toggled = { ...mockProduct, isAvailable: false }
            mockService.toggle.mockResolvedValue(toggled)

            const result = await controller.toggleAvailability("product-1")

            expect(result.isAvailable).toBe(false)
            expect(mockService.toggle).toHaveBeenCalledWith("product-1")
        })
    })
})
