import { SupportGroup } from "@zumda/core"

import type { SupportGroupRepository, SupportThread, SupportThreadRepository } from "@zumda/core"

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
}

export const SUPPORT_GROUP_SQL = `SELECT business_id, chat_id, title, connected_at
    FROM support_groups WHERE business_id = ?`

const THREAD_COLUMNS = "chat_id, customer_telegram_id, business_id, thread_id, created_at"

export const THREAD_BY_CUSTOMER_SQL = `SELECT ${THREAD_COLUMNS} FROM support_threads
    WHERE chat_id = ? AND customer_telegram_id = ?`

export const THREAD_BY_TOPIC_SQL = `SELECT ${THREAD_COLUMNS} FROM support_threads
    WHERE chat_id = ? AND thread_id = ?`

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
                `INSERT INTO support_threads (${THREAD_COLUMNS}) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT DO NOTHING`,
            )
            .bind(
                thread.chatId,
                thread.customerTelegramId,
                thread.businessId,
                thread.threadId,
                thread.createdAt.getTime(),
            )
            .run()
        return result.meta.changes > 0
    }

    async replace(thread: SupportThread): Promise<void> {
        await this.db
            .prepare(
                `UPDATE support_threads SET thread_id = ?, created_at = ?
                 WHERE chat_id = ? AND customer_telegram_id = ?`,
            )
            .bind(
                thread.threadId,
                thread.createdAt.getTime(),
                thread.chatId,
                thread.customerTelegramId,
            )
            .run()
    }
}
