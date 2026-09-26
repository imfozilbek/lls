import { Courier, CourierInvite, Phone, TelegramId } from "@lls/core"

import { sha256Hex } from "../crypto.js"

import { bool, flag } from "./rows.js"

import type { CourierRepository } from "@lls/core"

interface CourierRow {
    id: string
    business_id: string
    telegram_id: number
    name: string
    phone: string | null
    is_active: number
    created_at: number
    updated_at: number
}

interface InviteRow {
    business_id: string
    created_at: number
    expires_at: number
    used_at: number | null
}

const COLUMNS = "id, business_id, telegram_id, name, phone, is_active, created_at, updated_at"

function toCourier(row: CourierRow): Courier {
    return Courier.reconstitute({
        id: row.id,
        businessId: row.business_id,
        telegramId: TelegramId.create(row.telegram_id),
        name: row.name,
        phone: row.phone === null ? undefined : Phone.create(row.phone),
        isActive: bool(row.is_active),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
}

export class D1CourierRepository implements CourierRepository {
    constructor(private readonly db: D1Database) {}

    async findById(id: string): Promise<Courier | null> {
        const row = await this.db
            .prepare(`SELECT ${COLUMNS} FROM couriers WHERE id = ?`)
            .bind(id)
            .first<CourierRow>()
        return row ? toCourier(row) : null
    }

    async findByTelegramId(businessId: string, telegramId: number): Promise<Courier | null> {
        const row = await this.db
            .prepare(`SELECT ${COLUMNS} FROM couriers WHERE business_id = ? AND telegram_id = ?`)
            .bind(businessId, telegramId)
            .first<CourierRow>()
        return row ? toCourier(row) : null
    }

    async listActive(businessId: string): Promise<Courier[]> {
        const { results } = await this.db
            .prepare(
                `SELECT ${COLUMNS} FROM couriers WHERE business_id = ? AND is_active = 1
                 ORDER BY created_at`,
            )
            .bind(businessId)
            .all<CourierRow>()
        return results.map(toCourier)
    }

    async save(courier: Courier): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO couriers (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name, phone = excluded.phone,
                    is_active = excluded.is_active, updated_at = excluded.updated_at`,
            )
            .bind(
                courier.id,
                courier.businessId,
                courier.telegramId.value,
                courier.name,
                courier.phone?.number ?? null,
                flag(courier.isActive),
                courier.createdAt.getTime(),
                courier.updatedAt.getTime(),
            )
            .run()
    }

    async saveInvite(invite: CourierInvite): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO courier_invites (code_hash, business_id, created_at, expires_at, used_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT (code_hash) DO UPDATE SET used_at = excluded.used_at`,
            )
            .bind(
                await sha256Hex(invite.code),
                invite.businessId,
                invite.createdAt.getTime(),
                invite.expiresAt.getTime(),
                invite.usedAt?.getTime() ?? null,
            )
            .run()
    }

    async findInvite(code: string): Promise<CourierInvite | null> {
        const row = await this.db
            .prepare(
                `SELECT business_id, created_at, expires_at, used_at FROM courier_invites
                 WHERE code_hash = ?`,
            )
            .bind(await sha256Hex(code))
            .first<InviteRow>()
        if (!row) {
            return null
        }
        return CourierInvite.reconstitute({
            code,
            businessId: row.business_id,
            createdAt: new Date(row.created_at),
            expiresAt: new Date(row.expires_at),
            usedAt: row.used_at === null ? undefined : new Date(row.used_at),
        })
    }
}
