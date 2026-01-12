import { Controller, Get, Param, Query } from "@nestjs/common"

import { AnalyticsService } from "./analytics.service.js"

import type {
    AnalyticsDashboardDTO,
    AnalyticsPeriod,
    SalesChartDTO,
    TopProductsDTO,
} from "@lls/core"

@Controller("analytics")
export class AnalyticsController {
    constructor(private readonly service: AnalyticsService) {}

    @Get("business/:businessId")
    async getDashboard(
        @Param("businessId") businessId: string,
        @Query("period") period: AnalyticsPeriod = "week",
        @Query("startDate") startDate?: string,
        @Query("endDate") endDate?: string,
    ): Promise<AnalyticsDashboardDTO> {
        return this.service.getDashboard({
            businessId,
            period,
            startDate,
            endDate,
        })
    }

    @Get("business/:businessId/sales")
    async getSales(
        @Param("businessId") businessId: string,
        @Query("period") period: AnalyticsPeriod = "week",
        @Query("startDate") startDate?: string,
        @Query("endDate") endDate?: string,
    ): Promise<SalesChartDTO> {
        return this.service.getSales({
            businessId,
            period,
            startDate,
            endDate,
        })
    }

    @Get("business/:businessId/top-products")
    async getTopProducts(
        @Param("businessId") businessId: string,
        @Query("period") period: AnalyticsPeriod = "week",
        @Query("limit") limit?: string,
        @Query("startDate") startDate?: string,
        @Query("endDate") endDate?: string,
    ): Promise<TopProductsDTO> {
        return this.service.getTop({
            businessId,
            period,
            limit: limit ? parseInt(limit, 10) : undefined,
            startDate,
            endDate,
        })
    }
}
