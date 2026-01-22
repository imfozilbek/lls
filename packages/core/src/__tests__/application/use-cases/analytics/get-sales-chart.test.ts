import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetSalesChartUseCase } from "../../../../application/use-cases/analytics/get-sales-chart.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { AnalyticsRepository } from "../../../../application/ports/analytics-repository.js"
import type { BusinessRepository } from "../../../../application/ports/business-repository.js"

describe("GetSalesChartUseCase", () => {
    let useCase: GetSalesChartUseCase
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

    const mockDailySales = [
        { date: "2026-01-14", revenue: { amount: 1000000, currency: "UZS" }, orderCount: 20 },
        { date: "2026-01-15", revenue: { amount: 1500000, currency: "UZS" }, orderCount: 30 },
    ]

    beforeEach(() => {
        mockAnalyticsRepo = {
            getBusinessStats: vi.fn(),
            getDailySales: vi.fn().mockResolvedValue(mockDailySales),
            getTopProducts: vi.fn(),
            getOrderStatusBreakdown: vi.fn(),
        }

        mockBusinessRepo = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findAll: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }

        useCase = new GetSalesChartUseCase(mockAnalyticsRepo, mockBusinessRepo)
    })

    it("should return sales chart data", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        const result = await useCase.execute({
            businessId: "business-1",
            period: "week",
        })

        expect(result.data).toEqual(mockDailySales)
        expect(result.period).toBe("week")
        expect(result.totalRevenue.amount).toBe(2500000)
        expect(result.totalOrders).toBe(50)
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

    it("should calculate totals from daily sales", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        const result = await useCase.execute({
            businessId: "business-1",
            period: "month",
        })

        // 1000000 + 1500000 = 2500000
        expect(result.totalRevenue.amount).toBe(2500000)
        expect(result.totalRevenue.currency).toBe("UZS")

        // 20 + 30 = 50
        expect(result.totalOrders).toBe(50)
    })

    it("should handle empty sales data", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())
        vi.mocked(mockAnalyticsRepo.getDailySales).mockResolvedValue([])

        const result = await useCase.execute({
            businessId: "business-1",
            period: "week",
        })

        expect(result.data).toEqual([])
        expect(result.totalRevenue.amount).toBe(0)
        expect(result.totalRevenue.currency).toBe("UZS")
        expect(result.totalOrders).toBe(0)
    })

    it("should use custom date range when provided", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        await useCase.execute({
            businessId: "business-1",
            period: "month",
            startDate: "2026-01-01",
            endDate: "2026-01-31",
        })

        expect(mockAnalyticsRepo.getDailySales).toHaveBeenCalledWith(
            "business-1",
            expect.objectContaining({
                startDate: expect.any(Date),
                endDate: expect.any(Date),
            }),
        )
    })
})
