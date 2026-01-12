import "reflect-metadata"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CustomerController } from "../../modules/customer/customer.controller.js"

import type { CustomerDTO } from "@lls/core"
import type { CustomerService } from "../../modules/customer/customer.service.js"

describe("CustomerController", () => {
    let controller: CustomerController
    let mockService: {
        getOrCreate: ReturnType<typeof vi.fn>
        update: ReturnType<typeof vi.fn>
    }

    const mockCustomer: CustomerDTO = {
        id: "customer-1",
        telegramId: 123456789,
        name: "John Doe",
        phone: "+998 90 123 45 67",
        address: { street: "Main St", city: "Tashkent" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }

    beforeEach(() => {
        mockService = {
            getOrCreate: vi.fn(),
            update: vi.fn(),
        }

        controller = new CustomerController(mockService as unknown as CustomerService)
    })

    describe("getOrCreate", () => {
        it("should return existing customer", async () => {
            mockService.getOrCreate.mockResolvedValue(mockCustomer)

            const result = await controller.getOrCreate({
                telegramId: 123456789,
                firstName: "John",
            })

            expect(result.id).toBe("customer-1")
            expect(mockService.getOrCreate).toHaveBeenCalledWith({
                telegramId: 123456789,
                firstName: "John",
            })
        })

        it("should create new customer if not exists", async () => {
            const newCustomer = { ...mockCustomer, id: "customer-2", name: "Jane" }
            mockService.getOrCreate.mockResolvedValue(newCustomer)

            const result = await controller.getOrCreate({
                telegramId: 987654321,
                firstName: "Jane",
            })

            expect(result.name).toBe("Jane")
        })
    })

    describe("update", () => {
        it("should update customer profile", async () => {
            const updated = { ...mockCustomer, name: "John Smith" }
            mockService.update.mockResolvedValue(updated)

            const result = await controller.update("customer-1", { name: "John Smith" })

            expect(result.name).toBe("John Smith")
            expect(mockService.update).toHaveBeenCalledWith("customer-1", { name: "John Smith" })
        })

        it("should update customer address", async () => {
            const updated = {
                ...mockCustomer,
                address: { street: "New Street", city: "Samarkand" },
            }
            mockService.update.mockResolvedValue(updated)

            const result = await controller.update("customer-1", {
                address: { street: "New Street", city: "Samarkand" },
            })

            expect(result.address.city).toBe("Samarkand")
        })
    })
})
