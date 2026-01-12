import "reflect-metadata"
import { BusinessType } from "@lls/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BusinessController } from "../../modules/business/business.controller.js"

import type { BusinessDTO } from "@lls/core"
import type { BusinessService } from "../../modules/business/business.service.js"

describe("BusinessController", () => {
    let controller: BusinessController
    let mockService: {
        list: ReturnType<typeof vi.fn>
        getById: ReturnType<typeof vi.fn>
        create: ReturnType<typeof vi.fn>
        update: ReturnType<typeof vi.fn>
    }

    const mockBusiness: BusinessDTO = {
        id: "business-1",
        name: "Pizza Place",
        type: BusinessType.FOOD,
        address: { street: "Main St", city: "Tashkent" },
        telegramId: 123456789,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }

    beforeEach(() => {
        mockService = {
            list: vi.fn(),
            getById: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        }

        controller = new BusinessController(mockService as unknown as BusinessService)
    })

    describe("list", () => {
        it("should return array of businesses", async () => {
            mockService.list.mockResolvedValue([mockBusiness])

            const result = await controller.list()

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe("Pizza Place")
            expect(mockService.list).toHaveBeenCalled()
        })
    })

    describe("getById", () => {
        it("should return business by id", async () => {
            mockService.getById.mockResolvedValue(mockBusiness)

            const result = await controller.getById("business-1")

            expect(result.id).toBe("business-1")
            expect(mockService.getById).toHaveBeenCalledWith("business-1")
        })
    })

    describe("create", () => {
        it("should create new business", async () => {
            mockService.create.mockResolvedValue(mockBusiness)

            const input = {
                name: "Pizza Place",
                type: BusinessType.FOOD,
                address: { street: "Main St", city: "Tashkent" },
                telegramId: 123456789,
            }

            const result = await controller.create(input)

            expect(result.name).toBe("Pizza Place")
            expect(mockService.create).toHaveBeenCalledWith(input)
        })
    })

    describe("update", () => {
        it("should update business", async () => {
            const updatedBusiness = { ...mockBusiness, name: "New Pizza Place" }
            mockService.update.mockResolvedValue(updatedBusiness)

            const result = await controller.update("business-1", { name: "New Pizza Place" })

            expect(result.name).toBe("New Pizza Place")
            expect(mockService.update).toHaveBeenCalledWith("business-1", {
                name: "New Pizza Place",
            })
        })
    })
})
