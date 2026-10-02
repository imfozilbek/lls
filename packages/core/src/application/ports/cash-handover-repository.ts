import type { CashHandover } from "../../domain/entities/cash-handover.js"

export interface CourierAmount {
    courierId: string
    amount: number
}

export interface CashHandoverRepository {
    insert(handover: CashHandover): Promise<void>
    /** Everything each courier of the shop has handed over so far. */
    totalsByCourier(businessId: string): Promise<CourierAmount[]>
}
