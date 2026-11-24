import { SupportGroup } from "@zumda/core"

import type {
    SupportGroupRepository,
    SupportRefusal,
    SupportRefusalReason,
    SupportRefusalRepository,
    SupportThread,
    SupportThreadRepository,
} from "@zumda/core"

interface GroupRow {
    business_id: string
    chat_id: number
    title: string
    connected_at: number
}

interface ThreadRow {
    chat_id: number
    customer_telegram_id: number
    business_id: string
    thread_id: number
    created_at: number
    waiting_since: number | null
    card_message_id: number | null
    topic_name: string | null
}

interface RefusalRow {
    business_id: string
    reason: SupportRefusalReason
    title: string
    at: number
}

export const SUPPORT_GROUP_SQL = `SELECT business_id, chat_id, title, connected_at
    FROM support_groups WHERE business_id = ?`

const THREAD_COLUMNS = `chat_id, customer_telegram_id, business_id, thread_id, created_at,
    waiting_since, card_message_id, topic_name`

export const THREAD_BY_CUSTOMER_SQL = `SELECT ${THREAD_COLUMNS} FROM support_threads
    WHERE chat_id = ? AND customer_telegram_id = ?`

export const THREAD_BY_TOPIC_SQL = `SELECT ${THREAD_COLUMNS} FROM support_threads
    WHERE chat_id = ? AND thread_id = ?`

export const MARK_WAITING_SQL = `UPDATE support_threads SET waiting_since = ?
    WHERE chat_id = ? AND customer_telegram_id = ? AND waiting_since IS NULL`

export const MARK_ANSWERED_SQL = `UPDATE support_threads SET waiting_since = NULL
    WHERE chat_id = ? AND thread_id = ? AND waiting_since IS NOT NULL`

export const SUPPORT_REFUSAL_SQL = `SELECT business_id, reason, title, at
    FROM support_refusals WHERE business_id = ?`

export class D1SupportGroupRepository implements SupportGroupRepository {
    constructor(private readonly db: D1Database) {}

    async find(businessId: string): Promise<SupportGroup | null> {
        const row = await this.db.prepare(SUPPORT_GROUP_SQL).bind(businessId).first<GroupRow>()
        return row
            ? SupportGroup.connect({
                  businessId: row.business_id,
                  chatId: row.chat_id,
                  title: row.title,
                  connectedAt: new Date(row.connected_at),
              })
            : null
    }

    async save(group: SupportGroup): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO support_groups (business_id, chat_id, title, connected_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT (business_id) DO UPDATE SET chat_id = excluded.chat_id,
                    title = excluded.title, connected_at = excluded.connected_at`,
            )
            .bind(group.businessId, group.chatId, group.title, group.connectedAt.getTime())
            .run()
    }

    async remove(businessId: string): Promise<void> {
        await this.db
            .prepare("DELETE FROM support_groups WHERE business_id = ?")
            .bind(businessId)
            .run()
    }
}

function toThread(row: ThreadRow): SupportThread {
    return {
        businessId: row.business_id,
        chatId: row.chat_id,
        customerTelegramId: row.customer_telegram_id,
        threadId: row.thread_id,
        createdAt: new Date(row.created_at),
        ...(row.waiting_since === null ? {} : { waitingSince: new Date(row.waiting_since) }),
        ...(row.card_message_id === null ? {} : { cardMessageId: row.card_message_id }),
        ...(row.topic_name === null ? {} : { topicName: row.topic_name }),
    }
}

export class D1SupportThreadRepository implements SupportThreadRepository {
    constructor(private readonly db: D1Database) {}

    async findByCustomer(chatId: number, customer: number): Promise<SupportThread | null> {
        const row = await this.db
            .prepare(THREAD_BY_CUSTOMER_SQL)
            .bind(chatId, customer)
            .first<ThreadRow>()
        return row ? toThread(row) : null
    }

    async findByThread(chatId: number, threadId: number): Promise<SupportThread | null> {
        const row = await this.db
            .prepare(THREAD_BY_TOPIC_SQL)
            .bind(chatId, threadId)
            .first<ThreadRow>()
        return row ? toThread(row) : null
    }

    async insert(thread: SupportThread): Promise<boolean> {
        const result = await this.db
            .prepare(
                `INSERT INTO support_threads (${THREAD_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT DO NOTHING`,
            )
            .bind(
                thread.chatId,
                thread.customerTelegramId,
                thread.businessId,
                thread.threadId,
                thread.createdAt.getTime(),
                thread.waitingSince?.getTime() ?? null,
                thread.cardMessageId ?? null,
                thread.topicName ?? null,
            )
            .run()
        return result.meta.changes > 0
    }

    async replace(thread: SupportThread): Promise<void> {
        await this.db
            .prepare(
                `UPDATE support_threads SET thread_id = ?, created_at = ?, waiting_since = ?,
                    card_message_id = NULL, topic_name = ?
                 WHERE chat_id = ? AND customer_telegram_id = ?`,
            )
            .bind(
                thread.threadId,
                thread.createdAt.getTime(),
                thread.waitingSince?.getTime() ?? null,
                thread.topicName ?? null,
                thread.chatId,
                thread.customerTelegramId,
            )
            .run()
    }

    /** One conditional UPDATE: only a topic not waiting yet is written. */
    async markWaiting(chatId: number, customer: number, at: Date): Promise<boolean> {
        const result = await this.db
            .prepare(MARK_WAITING_SQL)
            .bind(at.getTime(), chatId, customer)
            .run()
        return result.meta.changes > 0
    }

    async markAnswered(chatId: number, threadId: number): Promise<boolean> {
        const result = await this.db.prepare(MARK_ANSWERED_SQL).bind(chatId, threadId).run()
        return result.meta.changes > 0
    }

    async saveCard(chatId: number, customer: number, messageId: number): Promise<void> {
        await this.db
            .prepare(
                `UPDATE support_threads SET card_message_id = ?
                 WHERE chat_id = ? AND customer_telegram_id = ?`,
            )
            .bind(messageId, chatId, customer)
            .run()
    }

    async saveName(chatId: number, customer: number, name: string): Promise<void> {
        await this.db
            .prepare(
                `UPDATE support_threads SET topic_name = ?
                 WHERE chat_id = ? AND customer_telegram_id = ?`,
            )
            .bind(name, chatId, customer)
            .run()
    }
}

export class D1SupportRefusalRepository implements SupportRefusalRepository {
    constructor(private readonly db: D1Database) {}

    async find(businessId: string): Promise<SupportRefusal | null> {
        const row = await this.db.prepare(SUPPORT_REFUSAL_SQL).bind(businessId).first<RefusalRow>()
        return row
            ? {
                  businessId: row.business_id,
                  reason: row.reason,
                  title: row.title,
                  at: new Date(row.at),
              }
            : null
    }

    async save(refusal: SupportRefusal): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO support_refusals (business_id, reason, title, at) VALUES (?, ?, ?, ?)
                 ON CONFLICT (business_id) DO UPDATE SET reason = excluded.reason,
                    title = excluded.title, at = excluded.at`,
            )
            .bind(refusal.businessId, refusal.reason, refusal.title, refusal.at.getTime())
            .run()
    }

    async clear(businessId: string): Promise<void> {
        await this.db
            .prepare("DELETE FROM support_refusals WHERE business_id = ?")
            .bind(businessId)
            .run()
    }
}
