import type { OrderDTO } from "./order.dto.js"
import type { MoneyTotals } from "../ports/order-repository.js"

export type MoneyPeriod = "today" | "week" | "month"

export const MONEY_PERIODS: readonly MoneyPeriod[] = ["today", "week", "month"]

/** «Деньги» in "Мой магазин": the period's sums and everything that needs the owner. */
export interface MoneyReportDTO {
    period: MoneyPeriod
    from: string
    to: string
    totals: MoneyTotals
    /** The customer pressed «Я перевёл»: check the card and confirm. */
    awaiting: OrderDTO[]
    /** Cancelled after payment: give the money back. */
    refunds: OrderDTO[]
    /** Cash the shop's couriers collected and still have to hand over, one entry per courier. */
    courierCash: CourierCashDTO[]
}

export interface CourierCashDTO {
    courierId: string
    courierName: string
    /** UZS the courier owes the shop. */
    total: number
    /** The orders it came from, oldest first: the owner marks each one «Pulni oldim». */
    orders: OrderDTO[]
}
