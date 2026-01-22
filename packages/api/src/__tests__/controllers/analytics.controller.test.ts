import "reflect-metadata"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AnalyticsController } from "../../modules/analytics/analytics.controller.js"

import type { AnalyticsDashboardDTO, SalesChartDTO, TopProductsDTO } from "@lls/core"
import type { AnalyticsService } from "../../modules/analytics/analytics.service.js"

describe("AnalyticsController", () => {
    let controller: AnalyticsController
    let mockService: {
        getDashboard: ReturnType<typeof vi.fn>
        getSales: ReturnType<typeof vi.fn>
        getTop: ReturnType<typeof vi.fn>
    }

    const mockDashboard: AnalyticsDashboardDTO = {
        businessId: "business-1",
        period: "week",
        stats: {
            totalOrders: 100,
            totalRevenue: { amount: 5000000, currency: "UZS" },
            averageOrderValue: { amount: 50000, currency: "UZS" },
            completedOrders: 90,
            cancelledOrders: 10,
        },
        salesChart: {
            labels: ["Mon", "Tue", "Wed"],
            data: [100000, 150000, 200000],
        },
        topProducts: [
            { productId: "prod-1", productName: "Pizza", quantity: 50, revenue: 2500000 },
        ],
        orderStatusBreakdown: {
            pending: 5,
            accepted: 10,
            preparing: 5,
            ready: 0,
            pickedUp: 0,
            delivered: 90,
            cancelled: 10,
        },
    }

    const mockSalesChart: SalesChartDTO = {
        businessId: "business-1",
        period: "week",
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        data: [100000, 150000, 200000, 180000, 220000, 300000, 250000],
    }

    const mockTopProducts: TopProductsDTO = {
        businessId: "business-1",
        period: "week",
        products: [
            {
                productId: "prod-1",
                productName: "Pizza Margherita",
                quantity: 50,
                revenue: 2500000,
            },
            { productId: "prod-2", productName: "Pasta Carbonara", quantity: 30, revenue: 1500000 },
        ],
    }

    beforeEach(() => {
        mockService = {
            getDashboard: vi.fn(),
            getSales: vi.fn(),
            getTop: vi.fn(),
        }

        controller = new AnalyticsController(mockService as unknown as AnalyticsService)
    })

    describe("getDashboard", () => {
        it("should return analytics dashboard", async () => {
            mockService.getDashboard.mockResolvedValue(mockDashboard)

            const result = await controller.getDashboard("business-1", "week")

            expect(result.businessId).toBe("business-1")
            expect(result.stats.totalOrders).toBe(100)
            expect(mockService.getDashboard).toHaveBeenCalledWith({
                businessId: "business-1",
                period: "week",
                startDate: undefined,
                endDate: undefined,
            })
        })

        it("should pass custom date range", async () => {
            mockService.getDashboard.mockResolvedValue(mockDashboard)

            await controller.getDashboard("business-1", "month", "2026-01-01", "2026-01-31")

            expect(mockService.getDashboard).toHaveBeenCalledWith({
                businessId: "business-1",
                period: "month",
                startDate: "2026-01-01",
                endDate: "2026-01-31",
            })
        })
    })

    describe("getSales", () => {
        it("should return sales chart data", async () => {
            mockService.getSales.mockResolvedValue(mockSalesChart)

            const result = await controller.getSales("business-1", "week")

            expect(result.businessId).toBe("business-1")
            expect(result.labels).toHaveLength(7)
            expect(result.data).toHaveLength(7)
            expect(mockService.getSales).toHaveBeenCalledWith({
                businessId: "business-1",
                period: "week",
                startDate: undefined,
                endDate: undefined,
            })
        })
    })

    describe("getTopProducts", () => {
        it("should return top products", async () => {
            mockService.getTop.mockResolvedValue(mockTopProducts)

            const result = await controller.getTopProducts("business-1", "week")

            expect(result.businessId).toBe("business-1")
            expect(result.products).toHaveLength(2)
            expect(result.products[0].productName).toBe("Pizza Margherita")
            expect(mockService.getTop).toHaveBeenCalledWith({
                businessId: "business-1",
                period: "week",
                limit: undefined,
                startDate: undefined,
                endDate: undefined,
            })
        })

        it("should pass custom limit", async () => {
            mockService.getTop.mockResolvedValue(mockTopProducts)

            await controller.getTopProducts("business-1", "month", "10")

            expect(mockService.getTop).toHaveBeenCalledWith({
                businessId: "business-1",
                period: "month",
                limit: 10,
                startDate: undefined,
                endDate: undefined,
            })
        })
    })
})
