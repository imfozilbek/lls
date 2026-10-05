/** A «Новый заказ рядом» message: changed to «Уже взяли» once someone takes the order. */
export interface NetworkOffer {
    telegramId: number
    messageId: number
}

/** Telegram message ids of the network offers of each order (worker-only: chat plumbing). */
export class D1NetworkOfferRepository {
    constructor(private readonly db: D1Database) {}

    async save(orderId: string, offer: NetworkOffer, at: Date): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO network_offers (order_id, telegram_id, message_id, created_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT (order_id, telegram_id) DO UPDATE SET message_id = excluded.message_id`,
            )
            .bind(orderId, offer.telegramId, offer.messageId, at.getTime())
            .run()
    }

    /** A whole fan-out's offers in one batch: one D1 call, not one per courier. */
    async saveMany(orderId: string, offers: readonly NetworkOffer[], at: Date): Promise<void> {
        if (offers.length === 0) {
            return
        }
        await this.db.batch(
            offers.map((offer) =>
                this.db
                    .prepare(
                        `INSERT INTO network_offers (order_id, telegram_id, message_id, created_at)
                         VALUES (?, ?, ?, ?)
                         ON CONFLICT (order_id, telegram_id)
                         DO UPDATE SET message_id = excluded.message_id`,
                    )
                    .bind(orderId, offer.telegramId, offer.messageId, at.getTime()),
            ),
        )
    }

    async list(orderId: string): Promise<NetworkOffer[]> {
        const { results } = await this.db
            .prepare(
                `SELECT telegram_id AS telegramId, message_id AS messageId FROM network_offers
                 WHERE order_id = ?`,
            )
            .bind(orderId)
            .all<NetworkOffer>()
        return results
    }

    /** The offers were answered (taken, cancelled, or the shop's courier took the order). */
    async clear(orderId: string): Promise<void> {
        await this.db.prepare("DELETE FROM network_offers WHERE order_id = ?").bind(orderId).run()
    }

    /** Who was already told about this order: a second fan-out skips them. */
    async recipients(orderId: string): Promise<Set<number>> {
        return new Set((await this.list(orderId)).map((offer) => offer.telegramId))
    }
}
