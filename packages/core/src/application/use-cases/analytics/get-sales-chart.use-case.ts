import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"

import { getDateRangeForPeriod, parseDateRange } from "./date-range.util.js"

import type { AnalyticsInput, SalesChartDTO } from "../../dtos/analytics.dto.js"
import type { MoneyDTO } from "../../dtos/common.dto.js"
import type { AnalyticsRepository } from "../../ports/analytics-repository.js"
import type { BusinessRepository } from "../../ports/business-repository.js"

export class GetSalesChartUseCase {
    constructor(
        private readonly analyticsRepository: AnalyticsRepository,
        private readonly businessRepository: BusinessRepository,
    ) {}

    async execute(input: AnalyticsInput): Promise<SalesChartDTO> {
        const { businessId, period, startDate, endDate } = input

        // Verify business exists
        const business = await this.businessRepository.findById(businessId)
        if (!business) {
            throw EntityNotFoundError.business(businessId)
        }

        // Determine date range
        const customRange = parseDateRange(startDate, endDate)
        const dateRange = customRange ?? getDateRangeForPeriod(period)

        // Fetch daily sales data
        const dailySales = await this.analyticsRepository.getDailySales(businessId, dateRange)

        // Calculate totals
        const totalRevenue = dailySales.reduce((sum, day) => sum + day.revenue.amount, 0)
        const totalOrders = dailySales.reduce((sum, day) => sum + day.orderCount, 0)

        const currency = dailySales[0]?.revenue.currency ?? "UZS"
        const totalRevenueDTO: MoneyDTO = { amount: totalRevenue, currency }

        return {
            data: dailySales,
            period,
            totalRevenue: totalRevenueDTO,
            totalOrders,
        }
    }
}
