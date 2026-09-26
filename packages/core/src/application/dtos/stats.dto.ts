export interface OrderStatsDTO {
    /** Orders placed in the period, excluding cancelled ones. */
    orders: number
    delivered: number
    cancelled: number
    /** Sum of totals of delivered orders, UZS. */
    revenue: number
}

export interface ShopStatsDTO {
    today: OrderStatsDTO
    /** The last 7 local days including today. */
    week: OrderStatsDTO
}
