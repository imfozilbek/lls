import { OrderStatus } from "@lls/core"
import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { Order, OrderDocument } from "../../database/schemas/order.schema.js"

import type {
    AnalyticsPeriod,
    AnalyticsRepository,
    AnalyticsDateRange,
    BusinessStatsDTO,
    DailySalesDTO,
    TopProductDTO,
    OrderStatusBreakdownDTO,
} from "@lls/core"

@Injectable()
export class MongoDbAnalyticsRepository implements AnalyticsRepository {
    constructor(
        @InjectModel(Order.name)
        private readonly orderModel: Model<OrderDocument>,
    ) {}

    async getBusinessStats(
        businessId: string,
        period: AnalyticsPeriod,
        dateRange: AnalyticsDateRange,
    ): Promise<BusinessStatsDTO> {
        const { startDate, endDate } = dateRange

        const result = await this.orderModel.aggregate([
            {
                $match: {
                    businessId,
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", OrderStatus.DELIVERED] },
                                "$total.amount",
                                0,
                            ],
                        },
                    },
                    totalOrders: { $sum: 1 },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ["$status", OrderStatus.DELIVERED] }, 1, 0] },
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $eq: ["$status", OrderStatus.CANCELLED] }, 1, 0] },
                    },
                    currency: { $first: "$total.currency" },
                },
            },
        ])

        const stats = result[0] ?? {
            totalRevenue: 0,
            totalOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            currency: "UZS",
        }

        const averageOrderValue =
            stats.completedOrders > 0 ? Math.round(stats.totalRevenue / stats.completedOrders) : 0

        return {
            totalRevenue: { amount: stats.totalRevenue, currency: stats.currency },
            totalOrders: stats.totalOrders,
            completedOrders: stats.completedOrders,
            cancelledOrders: stats.cancelledOrders,
            averageOrderValue: { amount: averageOrderValue, currency: stats.currency },
            period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        }
    }

    async getDailySales(
        businessId: string,
        dateRange: AnalyticsDateRange,
    ): Promise<DailySalesDTO[]> {
        const { startDate, endDate } = dateRange

        const result = await this.orderModel.aggregate([
            {
                $match: {
                    businessId,
                    status: OrderStatus.DELIVERED,
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    revenue: { $sum: "$total.amount" },
                    orderCount: { $sum: 1 },
                    currency: { $first: "$total.currency" },
                },
            },
            { $sort: { _id: 1 } },
        ])

        // Fill in missing dates with zero values
        const salesMap = new Map<string, DailySalesDTO>()
        const currency = result[0]?.currency ?? "UZS"

        // Initialize all dates
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().slice(0, 10)
            salesMap.set(dateKey, {
                date: dateKey,
                revenue: { amount: 0, currency },
                orderCount: 0,
            })
            currentDate.setDate(currentDate.getDate() + 1)
        }

        // Fill in actual data
        for (const item of result) {
            salesMap.set(item._id, {
                date: item._id,
                revenue: { amount: item.revenue, currency: item.currency },
                orderCount: item.orderCount,
            })
        }

        return Array.from(salesMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    }

    async getTopProducts(
        businessId: string,
        dateRange: AnalyticsDateRange,
        limit: number,
    ): Promise<TopProductDTO[]> {
        const { startDate, endDate } = dateRange

        const result = await this.orderModel.aggregate([
            {
                $match: {
                    businessId,
                    status: OrderStatus.DELIVERED,
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    productName: { $first: "$items.productName" },
                    quantity: { $sum: "$items.quantity" },
                    revenue: {
                        $sum: {
                            $multiply: ["$items.unitPrice.amount", "$items.quantity"],
                        },
                    },
                    orderCount: { $sum: 1 },
                    currency: { $first: "$items.unitPrice.currency" },
                },
            },
            { $sort: { revenue: -1 } },
            { $limit: limit },
        ])

        return result.map((item) => ({
            productId: item._id,
            productName: item.productName,
            quantity: item.quantity,
            revenue: { amount: item.revenue, currency: item.currency ?? "UZS" },
            orderCount: item.orderCount,
        }))
    }

    async getOrderStatusBreakdown(
        businessId: string,
        dateRange: AnalyticsDateRange,
    ): Promise<OrderStatusBreakdownDTO> {
        const { startDate, endDate } = dateRange

        const result = await this.orderModel.aggregate([
            {
                $match: {
                    businessId,
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ])

        const breakdown: OrderStatusBreakdownDTO = {
            pending: 0,
            accepted: 0,
            preparing: 0,
            ready: 0,
            pickedUp: 0,
            delivered: 0,
            cancelled: 0,
            total: 0,
        }

        for (const item of result) {
            const status = item._id as OrderStatus
            const count = item.count as number

            switch (status) {
                case OrderStatus.PENDING:
                    breakdown.pending = count
                    break
                case OrderStatus.ACCEPTED:
                    breakdown.accepted = count
                    break
                case OrderStatus.PREPARING:
                    breakdown.preparing = count
                    break
                case OrderStatus.READY:
                    breakdown.ready = count
                    break
                case OrderStatus.PICKED_UP:
                    breakdown.pickedUp = count
                    break
                case OrderStatus.DELIVERED:
                    breakdown.delivered = count
                    break
                case OrderStatus.CANCELLED:
                    breakdown.cancelled = count
                    break
            }
            breakdown.total += count
        }

        return breakdown
    }
}
