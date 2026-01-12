import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"

import { getDateRangeForPeriod, parseDateRange } from "./date-range.util.js"

import type { AnalyticsPeriod, TopProductsDTO } from "../../dtos/analytics.dto.js"
import type { AnalyticsRepository } from "../../ports/analytics-repository.js"
import type { BusinessRepository } from "../../ports/business-repository.js"

export interface GetTopProductsInput {
    businessId: string
    period: AnalyticsPeriod
    limit?: number
    startDate?: string
    endDate?: string
}

const DEFAULT_LIMIT = 10

export class GetTopProductsUseCase {
    constructor(
        private readonly analyticsRepository: AnalyticsRepository,
        private readonly businessRepository: BusinessRepository,
    ) {}

    async execute(input: GetTopProductsInput): Promise<TopProductsDTO> {
        const { businessId, period, limit = DEFAULT_LIMIT, startDate, endDate } = input

        // Verify business exists
        const business = await this.businessRepository.findById(businessId)
        if (!business) {
            throw EntityNotFoundError.business(businessId)
        }

        // Determine date range
        const customRange = parseDateRange(startDate, endDate)
        const dateRange = customRange ?? getDateRangeForPeriod(period)

        // Fetch top products
        const products = await this.analyticsRepository.getTopProducts(businessId, dateRange, limit)

        return {
            products,
            period,
            limit,
        }
    }
}
