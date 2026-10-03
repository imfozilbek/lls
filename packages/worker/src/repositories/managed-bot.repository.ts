import { decryptSecret, encryptSecret } from "../crypto.js"

import type { Clock, ManagedBotRecord, ManagedBotRepository } from "@zumda/core"

interface ManagedBotRow {
    bot_id: number
    bot_username: string
    owner_telegram_id: number
    business_id: string | null
}

const COLUMNS = "bot_id, bot_username, owner_telegram_id, business_id"

function toRecord(row: ManagedBotRow): ManagedBotRecord {
    return {
        botId: row.bot_id,
        username: row.bot_username,
        ownerTelegramId: row.owner_telegram_id,
        businessId: row.business_id ?? undefined,
    }
}

/** Bots created from the Zumda bot; the token is stored encrypted, like a shop's. */
export class D1ManagedBotRepository implements ManagedBotRepository {
    constructor(
        private readonly db: D1Database,
        private readonly encryptionKey: string,
        private readonly clock: Clock,
    ) {}

    async find(botId: number): Promise<ManagedBotRecord | null> {
        const row = await this.db
            .prepare(`SELECT ${COLUMNS} FROM managed_bots WHERE bot_id = ?`)
            .bind(botId)
            .first<ManagedBotRow>()
        return row ? toRecord(row) : null
    }

    async record(bot: ManagedBotRecord, token: string): Promise<void> {
        const now = this.clock.now().getTime()
        await this.db
            .prepare(
                `INSERT INTO managed_bots (bot_id, bot_username, owner_telegram_id, token_enc,
                    business_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (bot_id) DO UPDATE SET bot_username = excluded.bot_username,
                    owner_telegram_id = excluded.owner_telegram_id,
                    token_enc = excluded.token_enc, business_id = excluded.business_id,
                    updated_at = excluded.updated_at`,
            )
            .bind(
                bot.botId,
                bot.username,
                bot.ownerTelegramId,
                await encryptSecret(token, this.encryptionKey),
                bot.businessId ?? null,
                now,
                now,
            )
            .run()
    }

    async token(botId: number): Promise<string | null> {
        const row = await this.db
            .prepare("SELECT token_enc FROM managed_bots WHERE bot_id = ?")
            .bind(botId)
            .first<{ token_enc: string }>()
        return row ? decryptSecret(row.token_enc, this.encryptionKey) : null
    }

    async listUnclaimed(ownerTelegramId: number): Promise<ManagedBotRecord[]> {
        const { results } = await this.db
            .prepare(
                `SELECT ${COLUMNS} FROM managed_bots
                 WHERE owner_telegram_id = ? AND business_id IS NULL ORDER BY created_at DESC`,
            )
            .bind(ownerTelegramId)
            .all<ManagedBotRow>()
        return results.map(toRecord)
    }

    async claim(botId: number, businessId: string): Promise<void> {
        await this.db
            .prepare("UPDATE managed_bots SET business_id = ?, updated_at = ? WHERE bot_id = ?")
            .bind(businessId, this.clock.now().getTime(), botId)
            .run()
    }
}
