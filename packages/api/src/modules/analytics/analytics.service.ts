import { GetBusinessAnalyticsUseCase, GetSalesChartUseCase, GetTopProductsUseCase } from "@lls/core"
import { Injectable } from "@nestjs/common"

import { MongoDbAnalyticsRepository } from "../../infrastructure/repositories/mongodb-analytics.repository.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"

import type {
    AnalyticsDashboardDTO,
    AnalyticsInput,
    SalesChartDTO,
    TopProductsDTO,
    GetTopProductsInput,
} from "@lls/core"

@Injectable()
export class AnalyticsService {
    private readonly getBusinessAnalytics: GetBusinessAnalyticsUseCase
    private readonly getSalesChart: GetSalesChartUseCase
    private readonly getTopProducts: GetTopProductsUseCase

    constructor(
        analyticsRepository: MongoDbAnalyticsRepository,
        businessRepository: MongoDbBusinessRepository,
    ) {
        this.getBusinessAnalytics = new GetBusinessAnalyticsUseCase(
            analyticsRepository,
            businessRepository,
        )
        this.getSalesChart = new GetSalesChartUseCase(analyticsRepository, businessRepository)
        this.getTopProducts = new GetTopProductsUseCase(analyticsRepository, businessRepository)
    }

    async getDashboard(input: AnalyticsInput): Promise<AnalyticsDashboardDTO> {
        return this.getBusinessAnalytics.execute(input)
    }

    async getSales(input: AnalyticsInput): Promise<SalesChartDTO> {
        return this.getSalesChart.execute(input)
    }

    async getTop(input: GetTopProductsInput): Promise<TopProductsDTO> {
        return this.getTopProducts.execute(input)
    }
}
