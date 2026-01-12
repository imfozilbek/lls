import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"

import { getDateRangeForPeriod, parseDateRange } from "./date-range.util.js"

import type { AnalyticsInput, AnalyticsDashboardDTO } from "../../dtos/analytics.dto.js"
import type { AnalyticsRepository } from "../../ports/analytics-repository.js"
import type { BusinessRepository } from "../../ports/business-repository.js"

const DEFAULT_TOP_PRODUCTS_LIMIT = 5

export class GetBusinessAnalyticsUseCase {
    constructor(
        private readonly analyticsRepository: AnalyticsRepository,
        private readonly businessRepository: BusinessRepository,
    ) {}

    async execute(input: AnalyticsInput): Promise<AnalyticsDashboardDTO> {
        const { businessId, period, startDate, endDate } = input

        // Verify business exists
        const business = await this.businessRepository.findById(businessId)
        if (!business) {
            throw EntityNotFoundError.business(businessId)
        }

        // Determine date range
        const customRange = parseDateRange(startDate, endDate)
        const dateRange = customRange ?? getDateRangeForPeriod(period)

        // Fetch all analytics data in parallel
        const [stats, dailySales, topProducts, orderBreakdown] = await Promise.all([
            this.analyticsRepository.getBusinessStats(businessId, period, dateRange),
            this.analyticsRepository.getDailySales(businessId, dateRange),
            this.analyticsRepository.getTopProducts(
                businessId,
                dateRange,
                DEFAULT_TOP_PRODUCTS_LIMIT,
            ),
            this.analyticsRepository.getOrderStatusBreakdown(businessId, dateRange),
        ])

        return {
            stats,
            salesChart: {
                data: dailySales,
                period,
                totalRevenue: stats.totalRevenue,
                totalOrders: stats.totalOrders,
            },
            topProducts: {
                products: topProducts,
                period,
                limit: DEFAULT_TOP_PRODUCTS_LIMIT,
            },
            orderBreakdown,
        }
    }
}
