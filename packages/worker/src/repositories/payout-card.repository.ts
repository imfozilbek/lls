import { BusinessRuleViolationError, MAX_PAYOUT_CARDS, PayoutCard } from "@zumda/core"

import { isUniqueViolation } from "./rows.js"

import type { PayoutCardRepository, SavedPayoutCard } from "@zumda/core"

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
        try {
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
        } catch (error) {
            // The same card sent twice at once (a double tap): the person's own words, not 500.
            if (isUniqueViolation(error)) {
                throw BusinessRuleViolationError.cardExists()
            }
            throw error
        }
    }

    async delete(businessId: string, id: string): Promise<void> {
        await this.db
            .prepare("DELETE FROM payout_cards WHERE id = ? AND business_id = ?")
            .bind(id, businessId)
            .run()
    }
}
