import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetBusinessAnalyticsUseCase } from "../../../../application/use-cases/analytics/get-business-analytics.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { AnalyticsRepository } from "../../../../application/ports/analytics-repository.js"
import type { BusinessRepository } from "../../../../application/ports/business-repository.js"

describe("GetBusinessAnalyticsUseCase", () => {
    let useCase: GetBusinessAnalyticsUseCase
    let mockAnalyticsRepo: AnalyticsRepository
    let mockBusinessRepo: BusinessRepository

    const createBusiness = (): Business => {
        return Business.create({
            id: "business-1",
            name: "Test Restaurant",
            type: "food",
            telegramId: TelegramId.create(123456789),
            phone: Phone.create("+998901234567"),
            address: Address.create("Main St", "Tashkent"),
        })
    }

    const mockStats = {
        totalRevenue: { amount: 5000000, currency: "UZS" },
        totalOrders: 100,
        completedOrders: 90,
        cancelledOrders: 10,
        averageOrderValue: { amount: 50000, currency: "UZS" },
        period: "week" as const,
        startDate: "2026-01-09",
        endDate: "2026-01-15",
    }

    const mockDailySales = [
        { date: "2026-01-14", revenue: { amount: 1000000, currency: "UZS" }, orderCount: 20 },
        { date: "2026-01-15", revenue: { amount: 1500000, currency: "UZS" }, orderCount: 30 },
    ]

    const mockTopProducts = [
        {
            productId: "prod-1",
            productName: "Pizza",
            quantity: 50,
            revenue: { amount: 2500000, currency: "UZS" },
            orderCount: 50,
        },
    ]

    const mockOrderBreakdown = {
        pending: 5,
        accepted: 3,
        preparing: 2,
        ready: 0,
        pickedUp: 0,
        delivered: 90,
        cancelled: 10,
        total: 110,
    }

    beforeEach(() => {
        mockAnalyticsRepo = {
            getBusinessStats: vi.fn().mockResolvedValue(mockStats),
            getDailySales: vi.fn().mockResolvedValue(mockDailySales),
            getTopProducts: vi.fn().mockResolvedValue(mockTopProducts),
            getOrderStatusBreakdown: vi.fn().mockResolvedValue(mockOrderBreakdown),
        }

        mockBusinessRepo = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findAll: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }

        useCase = new GetBusinessAnalyticsUseCase(mockAnalyticsRepo, mockBusinessRepo)
    })

    it("should return analytics dashboard for valid business", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        const result = await useCase.execute({
            businessId: "business-1",
            period: "week",
        })

        expect(result.stats).toEqual(mockStats)
        expect(result.salesChart.data).toEqual(mockDailySales)
        expect(result.topProducts.products).toEqual(mockTopProducts)
        expect(result.orderBreakdown).toEqual(mockOrderBreakdown)
    })

    it("should throw EntityNotFoundError for non-existent business", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(null)

        await expect(
            useCase.execute({
                businessId: "non-existent",
                period: "week",
            }),
        ).rejects.toThrow(EntityNotFoundError)
    })

    it("should use custom date range when provided", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        await useCase.execute({
            businessId: "business-1",
            period: "month",
            startDate: "2026-01-01",
            endDate: "2026-01-31",
        })

        expect(mockAnalyticsRepo.getBusinessStats).toHaveBeenCalledWith(
            "business-1",
            "month",
            expect.objectContaining({
                startDate: expect.any(Date),
                endDate: expect.any(Date),
            }),
        )
    })

    it("should fetch all analytics in parallel", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        await useCase.execute({
            businessId: "business-1",
            period: "week",
        })

        expect(mockAnalyticsRepo.getBusinessStats).toHaveBeenCalledTimes(1)
        expect(mockAnalyticsRepo.getDailySales).toHaveBeenCalledTimes(1)
        expect(mockAnalyticsRepo.getTopProducts).toHaveBeenCalledTimes(1)
        expect(mockAnalyticsRepo.getOrderStatusBreakdown).toHaveBeenCalledTimes(1)
    })
})
