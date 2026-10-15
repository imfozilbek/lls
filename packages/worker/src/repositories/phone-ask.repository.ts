import { BusinessStatus, CourierStatus } from "@zumda/core"

import type {
    GuideOutcome,
    PhoneAskAudience,
    PhoneAskCount,
    PhoneAskRecipient,
    PhoneAskRecipients,
} from "@zumda/core"

/**
 * Everyone a missing phone stops now, one row a person (`audience`, `telegram_id`):
 * - owners of a live shop with no number to call: no «Mijozlar uchun telefon» and no phone of
 *   their own in Zumda (`shopCallPhone`); such a shop takes no orders. A demo is exempt;
 * - couriers waiting for or working at a live shop, without a phone in their profile: no
 *   approval, no orders.
 */
const PEOPLE = `
    SELECT 'owner' AS audience, telegram_id FROM (
        SELECT DISTINCT b.owner_telegram_id AS telegram_id FROM businesses b
        WHERE b.status = '${BusinessStatus.ACTIVE}' AND b.demo_at IS NULL
          AND b.contact_phone IS NULL
          AND NOT EXISTS (SELECT 1 FROM customers c
              WHERE c.telegram_id = b.owner_telegram_id AND c.phone IS NOT NULL)
    )
    UNION ALL
    SELECT 'courier' AS audience, telegram_id FROM (
        SELECT DISTINCT c.telegram_id AS telegram_id FROM businesses b
        JOIN couriers c ON c.business_id = b.id
            AND c.status IN ('${CourierStatus.PENDING}', '${CourierStatus.ACTIVE}')
        JOIN courier_profiles cp ON cp.telegram_id = c.telegram_id
        WHERE b.status = '${BusinessStatus.ACTIVE}' AND b.demo_at IS NULL AND cp.phone IS NULL
    )`

/** Not asked since the time bound: someone asked waits a day. */
const NOT_ASKED = `NOT EXISTS (SELECT 1 FROM phone_asks a
    WHERE a.audience = p.audience AND a.telegram_id = p.telegram_id AND a.asked_at > ?)`

/** The next people to ask, owners first (bind: since, limit). */
export const NEXT_SQL = `SELECT p.audience, p.telegram_id FROM (${PEOPLE}) p
    WHERE ${NOT_ASKED}
    ORDER BY CASE p.audience WHEN 'owner' THEN 0 ELSE 1 END, p.telegram_id LIMIT ?`

/** Everyone without a phone per audience, and who is left to ask (bind: since). */
export const COUNT_SQL = `SELECT p.audience, COUNT(*) AS total,
        COALESCE(SUM(${NOT_ASKED}), 0) AS left_count
    FROM (${PEOPLE}) p GROUP BY p.audience`

const RECORD = `INSERT INTO phone_asks (audience, telegram_id, status, asked_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (audience, telegram_id) DO UPDATE
    SET status = excluded.status, asked_at = excluded.asked_at`

const AUDIENCES: readonly PhoneAskAudience[] = ["owner", "courier"]

interface PersonRow {
    audience: PhoneAskAudience
    telegram_id: number
}

interface CountRow {
    audience: PhoneAskAudience
    total: number
    left_count: number
}

export class D1PhoneAskRecipients implements PhoneAskRecipients {
    constructor(private readonly db: D1Database) {}

    async next(since: Date, limit: number): Promise<PhoneAskRecipient[]> {
        const { results } = await this.db
            .prepare(NEXT_SQL)
            .bind(since.getTime(), limit)
            .all<PersonRow>()
        return results.map((row) => ({ audience: row.audience, telegramId: row.telegram_id }))
    }

    async counts(since: Date): Promise<PhoneAskCount[]> {
        const { results } = await this.db.prepare(COUNT_SQL).bind(since.getTime()).all<CountRow>()
        return AUDIENCES.map((audience) => {
            const row = results.find((r) => r.audience === audience)
            return { audience, total: row?.total ?? 0, left: row?.left_count ?? 0 }
        })
    }

    async record(recipient: PhoneAskRecipient, outcome: GuideOutcome, at: Date): Promise<void> {
        await this.db
            .prepare(RECORD)
            .bind(recipient.audience, recipient.telegramId, outcome, at.getTime())
            .run()
    }
}
