import type { CashHandover, CashHandoverRepository, CourierAmount } from "@lls/core"

export class D1CashHandoverRepository implements CashHandoverRepository {
    constructor(private readonly db: D1Database) {}

    async insert(handover: CashHandover): Promise<void> {
        await this.db
            .prepare(
                "INSERT INTO cash_handovers (id, business_id, courier_id, amount, at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(
                handover.id,
                handover.businessId,
                handover.courierId,
                handover.amount.amount,
                handover.at.getTime(),
            )
            .run()
    }

    async totalsByCourier(businessId: string): Promise<CourierAmount[]> {
        const { results } = await this.db
            .prepare(
                `SELECT courier_id AS courierId, SUM(amount) AS amount FROM cash_handovers
                 WHERE business_id = ? GROUP BY courier_id`,
            )
            .bind(businessId)
            .all<CourierAmount>()
        return results
    }
}
