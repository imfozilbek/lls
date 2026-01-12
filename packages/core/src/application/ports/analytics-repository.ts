import type {
    AnalyticsPeriod,
    BusinessStatsDTO,
    DailySalesDTO,
    TopProductDTO,
    OrderStatusBreakdownDTO,
} from "../dtos/analytics.dto.js"

export interface AnalyticsDateRange {
    startDate: Date
    endDate: Date
}

export interface AnalyticsRepository {
    /**
     * Get business statistics for a period
     */
    getBusinessStats(
        businessId: string,
        period: AnalyticsPeriod,
        dateRange: AnalyticsDateRange,
    ): Promise<BusinessStatsDTO>

    /**
     * Get daily sales data for chart
     */
    getDailySales(businessId: string, dateRange: AnalyticsDateRange): Promise<DailySalesDTO[]>

    /**
     * Get top selling products
     */
    getTopProducts(
        businessId: string,
        dateRange: AnalyticsDateRange,
        limit: number,
    ): Promise<TopProductDTO[]>

    /**
     * Get order status breakdown
     */
    getOrderStatusBreakdown(
        businessId: string,
        dateRange: AnalyticsDateRange,
    ): Promise<OrderStatusBreakdownDTO>
}
