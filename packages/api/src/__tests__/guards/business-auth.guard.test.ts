import "reflect-metadata"

import { ForbiddenException, UnauthorizedException } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
    BusinessAuthGuard,
    BUSINESS_AUTH_MODE_KEY,
} from "../../common/guards/business-auth.guard.js"

import type { TelegramUser } from "../../common/guards/telegram-auth.guard.js"
import type { ExecutionContext } from "@nestjs/common"
import type { Business, Order, Product, TelegramId } from "@lls/core"

describe("BusinessAuthGuard", () => {
    let guard: BusinessAuthGuard
    let mockReflector: { get: ReturnType<typeof vi.fn> }
    let mockBusinessRepository: {
        findById: ReturnType<typeof vi.fn>
    }
    let mockProductRepository: {
        findById: ReturnType<typeof vi.fn>
    }
    let mockOrderRepository: {
        findById: ReturnType<typeof vi.fn>
    }

    const telegramUser: TelegramUser = {
        id: 123456789,
        firstName: "Test",
        lastName: "User",
    }

    const mockBusiness = {
        id: "business-1",
        name: "Test Business",
        telegramId: { value: 123456789 } as TelegramId,
    } as Business

    const mockProduct = {
        id: "product-1",
        businessId: "business-1",
        name: "Test Product",
    } as Product

    const mockOrder = {
        id: "order-1",
        businessId: "business-1",
        customerId: "customer-1",
    } as Order

    const createMockContext = (
        params: Record<string, string>,
        telegramUser?: TelegramUser,
    ): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    params,
                    telegramUser,
                }),
            }),
            getHandler: () => ({}),
        } as unknown as ExecutionContext
    }

    beforeEach(() => {
        mockReflector = { get: vi.fn() }
        mockBusinessRepository = { findById: vi.fn() }
        mockProductRepository = { findById: vi.fn() }
        mockOrderRepository = { findById: vi.fn() }

        guard = new BusinessAuthGuard(
            mockReflector as unknown as Reflector,
            mockBusinessRepository as never,
            mockProductRepository as never,
            mockOrderRepository as never,
        )
    })

    describe("business mode (default)", () => {
        it("should allow access when user owns the business", async () => {
            mockReflector.get.mockReturnValue(undefined) // default mode
            mockBusinessRepository.findById.mockResolvedValue(mockBusiness)

            const context = createMockContext({ id: "business-1" }, telegramUser)

            const result = await guard.canActivate(context)

            expect(result).toBe(true)
            expect(mockBusinessRepository.findById).toHaveBeenCalledWith("business-1")
        })

        it("should allow access with businessId param", async () => {
            mockReflector.get.mockReturnValue(undefined)
            mockBusinessRepository.findById.mockResolvedValue(mockBusiness)

            const context = createMockContext({ businessId: "business-1" }, telegramUser)

            const result = await guard.canActivate(context)

            expect(result).toBe(true)
        })

        it("should throw UnauthorizedException when no telegram user", async () => {
            mockReflector.get.mockReturnValue(undefined)

            const context = createMockContext({ id: "business-1" }, undefined)

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException)
        })

        it("should throw ForbiddenException when user does not own business", async () => {
            mockReflector.get.mockReturnValue(undefined)
            const otherBusiness = {
                ...mockBusiness,
                telegramId: { value: 999999999 } as TelegramId,
            }
            mockBusinessRepository.findById.mockResolvedValue(otherBusiness)

            const context = createMockContext({ id: "business-1" }, telegramUser)

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
        })

        it("should throw ForbiddenException when business not found", async () => {
            mockReflector.get.mockReturnValue(undefined)
            mockBusinessRepository.findById.mockResolvedValue(null)

            const context = createMockContext({ id: "business-1" }, telegramUser)

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
        })
    })

    describe("product mode", () => {
        it("should allow access when user owns the product's business", async () => {
            mockReflector.get.mockReturnValue("product")
            mockProductRepository.findById.mockResolvedValue(mockProduct)
            mockBusinessRepository.findById.mockResolvedValue(mockBusiness)

            const context = createMockContext({ id: "product-1" }, telegramUser)

            const result = await guard.canActivate(context)

            expect(result).toBe(true)
            expect(mockProductRepository.findById).toHaveBeenCalledWith("product-1")
            expect(mockBusinessRepository.findById).toHaveBeenCalledWith("business-1")
        })

        it("should throw ForbiddenException when product not found", async () => {
            mockReflector.get.mockReturnValue("product")
            mockProductRepository.findById.mockResolvedValue(null)

            const context = createMockContext({ id: "product-1" }, telegramUser)

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
        })
    })

    describe("order mode", () => {
        it("should allow access when user owns the order's business", async () => {
            mockReflector.get.mockReturnValue("order")
            mockOrderRepository.findById.mockResolvedValue(mockOrder)
            mockBusinessRepository.findById.mockResolvedValue(mockBusiness)

            const context = createMockContext({ id: "order-1" }, telegramUser)

            const result = await guard.canActivate(context)

            expect(result).toBe(true)
            expect(mockOrderRepository.findById).toHaveBeenCalledWith("order-1")
            expect(mockBusinessRepository.findById).toHaveBeenCalledWith("business-1")
        })

        it("should throw ForbiddenException when order not found", async () => {
            mockReflector.get.mockReturnValue("order")
            mockOrderRepository.findById.mockResolvedValue(null)

            const context = createMockContext({ id: "order-1" }, telegramUser)

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
        })
    })

    describe("reflector metadata", () => {
        it("should read mode from handler metadata", async () => {
            const handler = (): void => {}
            mockReflector.get.mockReturnValue("product")
            mockProductRepository.findById.mockResolvedValue(mockProduct)
            mockBusinessRepository.findById.mockResolvedValue(mockBusiness)

            const context = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        params: { id: "product-1" },
                        telegramUser,
                    }),
                }),
                getHandler: () => handler,
            } as unknown as ExecutionContext

            await guard.canActivate(context)

            expect(mockReflector.get).toHaveBeenCalledWith(BUSINESS_AUTH_MODE_KEY, handler)
        })
    })
})
