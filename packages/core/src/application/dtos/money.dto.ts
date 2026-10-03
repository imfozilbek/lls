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
}
