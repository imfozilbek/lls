import type { MoneyDTO } from "./common.dto.js"

/**
 * Period for analytics queries
 */
export type AnalyticsPeriod = "day" | "week" | "month"

/**
 * Input for analytics queries
 */
export interface AnalyticsInput {
    businessId: string
    period: AnalyticsPeriod
    startDate?: string
    endDate?: string
}

/**
 * Overall business statistics
 */
export interface BusinessStatsDTO {
    totalRevenue: MoneyDTO
    totalOrders: number
    completedOrders: number
    cancelledOrders: number
    averageOrderValue: MoneyDTO
    period: AnalyticsPeriod
    startDate: string
    endDate: string
}

/**
 * Daily sales data point
 */
export interface DailySalesDTO {
    date: string
    revenue: MoneyDTO
    orderCount: number
}

/**
 * Sales chart data
 */
export interface SalesChartDTO {
    data: DailySalesDTO[]
    period: AnalyticsPeriod
    totalRevenue: MoneyDTO
    totalOrders: number
}

/**
 * Top selling product
 */
export interface TopProductDTO {
    productId: string
    productName: string
    quantity: number
    revenue: MoneyDTO
    orderCount: number
}

/**
 * Top products response
 */
export interface TopProductsDTO {
    products: TopProductDTO[]
    period: AnalyticsPeriod
    limit: number
}

/**
 * Order status breakdown
 */
export interface OrderStatusBreakdownDTO {
    pending: number
    accepted: number
    preparing: number
    ready: number
    pickedUp: number
    delivered: number
    cancelled: number
    total: number
}

/**
 * Full analytics dashboard data
 */
export interface AnalyticsDashboardDTO {
    stats: BusinessStatsDTO
    salesChart: SalesChartDTO
    topProducts: TopProductsDTO
    orderBreakdown: OrderStatusBreakdownDTO
}
