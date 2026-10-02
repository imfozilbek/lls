import type { OrderDTO } from "./order.dto.js"
import type { MoneyTotals } from "../ports/order-repository.js"

export type MoneyPeriod = "today" | "week" | "month"

export const MONEY_PERIODS: readonly MoneyPeriod[] = ["today", "week", "month"]

export interface CourierCashDTO {
    courierId: string
    name: string
    /** Cash the courier holds now: taken at doors minus handed over. */
    onHand: number
    isActive: boolean
}

/** «Деньги» in "Мой магазин": the period's sums and everything that needs the owner. */
export interface MoneyReportDTO {
    period: MoneyPeriod
    from: string
    to: string
    totals: MoneyTotals
    /** Transfers to confirm. */
    awaiting: OrderDTO[]
    /** Delivered, not paid. */
    debts: OrderDTO[]
    /** Cancelled after payment: give the money back. */
    refunds: OrderDTO[]
    /** Couriers who hold cash, most first. */
    couriers: CourierCashDTO[]
}
