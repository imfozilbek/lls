import { describe, it, expect, vi, beforeEach } from "vitest"

import { GetTopProductsUseCase } from "../../../../application/use-cases/analytics/get-top-products.use-case.js"
import { Business } from "../../../../domain/entities/business.js"
import { EntityNotFoundError } from "../../../../domain/errors/not-found.error.js"
import { Address } from "../../../../domain/value-objects/address.js"
import { Phone } from "../../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../../domain/value-objects/telegram-id.js"

import type { AnalyticsRepository } from "../../../../application/ports/analytics-repository.js"
import type { BusinessRepository } from "../../../../application/ports/business-repository.js"

describe("GetTopProductsUseCase", () => {
    let useCase: GetTopProductsUseCase
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

    const mockTopProducts = [
        {
            productId: "prod-1",
            productName: "Pizza Margherita",
            quantity: 50,
            revenue: { amount: 2500000, currency: "UZS" },
            orderCount: 50,
        },
        {
            productId: "prod-2",
            productName: "Pasta Carbonara",
            quantity: 30,
            revenue: { amount: 1500000, currency: "UZS" },
            orderCount: 30,
        },
    ]

    beforeEach(() => {
        mockAnalyticsRepo = {
            getBusinessStats: vi.fn(),
            getDailySales: vi.fn(),
            getTopProducts: vi.fn().mockResolvedValue(mockTopProducts),
            getOrderStatusBreakdown: vi.fn(),
        }

        mockBusinessRepo = {
            findById: vi.fn(),
            findByTelegramId: vi.fn(),
            findAll: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        }

        useCase = new GetTopProductsUseCase(mockAnalyticsRepo, mockBusinessRepo)
    })

    it("should return top products", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        const result = await useCase.execute({
            businessId: "business-1",
            period: "week",
        })

        expect(result.products).toEqual(mockTopProducts)
        expect(result.period).toBe("week")
        expect(result.limit).toBe(10) // default limit
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

    it("should use custom limit when provided", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        const result = await useCase.execute({
            businessId: "business-1",
            period: "month",
            limit: 5,
        })

        expect(result.limit).toBe(5)
        expect(mockAnalyticsRepo.getTopProducts).toHaveBeenCalledWith(
            "business-1",
            expect.any(Object),
            5,
        )
    })

    it("should use custom date range when provided", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())

        await useCase.execute({
            businessId: "business-1",
            period: "month",
            startDate: "2026-01-01",
            endDate: "2026-01-31",
        })

        expect(mockAnalyticsRepo.getTopProducts).toHaveBeenCalledWith(
            "business-1",
            expect.objectContaining({
                startDate: expect.any(Date),
                endDate: expect.any(Date),
            }),
            10,
        )
    })

    it("should return empty array when no products sold", async () => {
        vi.mocked(mockBusinessRepo.findById).mockResolvedValue(createBusiness())
        vi.mocked(mockAnalyticsRepo.getTopProducts).mockResolvedValue([])

        const result = await useCase.execute({
            businessId: "business-1",
            period: "week",
        })

        expect(result.products).toEqual([])
    })
})
