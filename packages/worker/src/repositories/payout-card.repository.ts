import { MAX_PAYOUT_CARDS, PayoutCard } from "@lls/core"

import type { PayoutCardRepository, SavedPayoutCard } from "@lls/core"

interface CardRow {
    id: string
    number: string
    holder: string
    created_at: number
}

export class D1PayoutCardRepository implements PayoutCardRepository {
    constructor(private readonly db: D1Database) {}

    async listByBusiness(businessId: string): Promise<SavedPayoutCard[]> {
        const { results } = await this.db
            .prepare(
                `SELECT id, number, holder, created_at FROM payout_cards
                 WHERE business_id = ? ORDER BY created_at, id LIMIT ?`,
            )
            .bind(businessId, MAX_PAYOUT_CARDS)
            .all<CardRow>()
        return results.map((row) => ({
            id: row.id,
            card: PayoutCard.create(row.number, row.holder),
            createdAt: new Date(row.created_at),
        }))
    }

    async insert(businessId: string, saved: SavedPayoutCard): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO payout_cards (id, business_id, number, holder, created_at)
                 VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(
                saved.id,
                businessId,
                saved.card.number,
                saved.card.holder,
                saved.createdAt.getTime(),
            )
            .run()
    }

    async delete(businessId: string, id: string): Promise<void> {
        await this.db
            .prepare("DELETE FROM payout_cards WHERE id = ? AND business_id = ?")
            .bind(id, businessId)
            .run()
    }
}
