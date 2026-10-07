import { BusinessRuleViolationError, MAX_PAYOUT_CARDS, PayoutCard } from "@zumda/core"

import { isUniqueViolation } from "./rows.js"

import type { PayoutCardRepository, SavedPayoutCard } from "@zumda/core"

interface CardRow {
    id: string
    number: string
    holder: string
    created_at: number
}

const CARD_COLUMNS = "id, business_id, number, holder, created_at"

/**
 * The INSERT of one card. `afterUpdate`: only when the statement just before it in the same batch
 * changed a row (the shop's guarded save), so a shop that lost its save never gets the card.
 */
export function cardInsert(
    db: D1Database,
    businessId: string,
    saved: SavedPayoutCard,
    afterUpdate = false,
): D1PreparedStatement {
    const values = [
        saved.id,
        businessId,
        saved.card.number,
        saved.card.holder,
        saved.createdAt.getTime(),
    ]
    return afterUpdate
        ? db
              .prepare(
                  `INSERT INTO payout_cards (${CARD_COLUMNS})
                   SELECT ?, ?, ?, ?, ? WHERE changes() = 1`,
              )
              .bind(...values)
        : db
              .prepare(`INSERT INTO payout_cards (${CARD_COLUMNS}) VALUES (?, ?, ?, ?, ?)`)
              .bind(...values)
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
            await cardInsert(this.db, businessId, saved).run()
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
