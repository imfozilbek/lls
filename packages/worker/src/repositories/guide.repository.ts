import { BusinessStatus, CourierStatus, GUIDE_AUDIENCES } from "@zumda/core"

import type {
    GuideAudience,
    GuideCount,
    GuideOutcome,
    GuideRecipient,
    GuideRecipients,
} from "@zumda/core"

/**
 * Everyone an audience of «Qo'llanma» reaches, one row a person (`telegram_id`, `business_id`):
 * - owners of every business that is not turned off;
 * - couriers linked to a shop now (waiting, working or a network courier);
 * - customers of a live shop, with the shop they came to last (its bot sends the guide). A demo
 *   shop («Namuna») is not real: its customers are left out.
 */
const PEOPLE: Record<GuideAudience, string> = {
    owner: `SELECT DISTINCT owner_telegram_id AS telegram_id, NULL AS business_id
        FROM businesses WHERE status != '${BusinessStatus.DISABLED}'`,
    courier: `SELECT DISTINCT telegram_id, NULL AS business_id FROM couriers
        WHERE status IN ('${CourierStatus.PENDING}', '${CourierStatus.ACTIVE}', '${CourierStatus.NETWORK}')`,
    customer: `SELECT telegram_id, business_id FROM (
        SELECT cu.telegram_id AS telegram_id, (
            SELECT cb.business_id FROM customer_businesses cb
            JOIN businesses b ON b.id = cb.business_id
            WHERE cb.customer_id = cu.id AND b.status = '${BusinessStatus.ACTIVE}'
              AND b.demo_at IS NULL
            ORDER BY cb.first_order_at DESC LIMIT 1
        ) AS business_id
        FROM customers cu
    ) WHERE business_id IS NOT NULL`,
}

/** Not had this audience's guide yet: sent or unreachable, a person is written to once. */
const NOT_DONE = `NOT EXISTS (SELECT 1 FROM guide_sends g
    WHERE g.audience = ? AND g.telegram_id = p.telegram_id)`

/** The next people of an audience to send the guide to (bind: audience, limit). */
export function nextSql(audience: GuideAudience): string {
    return `SELECT telegram_id, business_id FROM (${PEOPLE[audience]}) p
        WHERE ${NOT_DONE} ORDER BY telegram_id LIMIT ?`
}

/** Everyone of an audience, and who is left (bind: audience). */
export function countSql(audience: GuideAudience): string {
    return `SELECT COUNT(*) AS total, COALESCE(SUM(${NOT_DONE}), 0) AS left_count
        FROM (${PEOPLE[audience]}) p`
}

const RECORD = `INSERT INTO guide_sends (audience, telegram_id, business_id, status, sent_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT (audience, telegram_id) DO NOTHING`

interface PersonRow {
    telegram_id: number
    business_id: string | null
}

export class D1GuideRecipients implements GuideRecipients {
    constructor(private readonly db: D1Database) {}

    async next(audience: GuideAudience, limit: number): Promise<GuideRecipient[]> {
        const { results } = await this.db
            .prepare(nextSql(audience))
            .bind(audience, limit)
            .all<PersonRow>()
        return results.map((row) => ({
            telegramId: row.telegram_id,
            ...(row.business_id ? { businessId: row.business_id } : {}),
        }))
    }

    async counts(): Promise<GuideCount[]> {
        const rows = await this.db.batch<{ total: number; left_count: number }>(
            GUIDE_AUDIENCES.map((audience) => this.db.prepare(countSql(audience)).bind(audience)),
        )
        return GUIDE_AUDIENCES.map((audience, i) => ({
            audience,
            total: rows[i]?.results[0]?.total ?? 0,
            left: rows[i]?.results[0]?.left_count ?? 0,
        }))
    }

    async record(
        audience: GuideAudience,
        recipient: GuideRecipient,
        outcome: GuideOutcome,
        at: Date,
    ): Promise<void> {
        await this.db
            .prepare(RECORD)
            .bind(
                audience,
                recipient.telegramId,
                recipient.businessId ?? null,
                outcome,
                at.getTime(),
            )
            .run()
    }
}
