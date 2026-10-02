import {
    COURIER_STATUSES,
    Courier,
    CourierInvite,
    CourierProfile,
    CourierStatus,
    Phone,
    TelegramId,
    WEEKDAYS,
} from "@lls/core"

import { sha256Hex } from "../crypto.js"

import { flag, oneOf, optional } from "./rows.js"

import type { CourierRepository, Weekday } from "@lls/core"

interface ProfileRow {
    telegram_id: number
    name: string
    phone: string | null
    vehicle: string | null
    shift_until: number | null
    profile_created_at: number
    profile_updated_at: number
}

interface CourierRow extends ProfileRow {
    id: string
    business_id: string
    status: string
    work_days: string
    off_until: number | null
    created_at: number
    updated_at: number
}

interface InviteRow {
    business_id: string
    created_at: number
    expires_at: number
    used_at: number | null
}

const PROFILE_COLUMNS = `p.telegram_id, p.name, p.phone, p.vehicle, p.shift_until,
    p.created_at AS profile_created_at, p.updated_at AS profile_updated_at`

/** A shop link with the person's profile: the name and phone live in the profile. */
const SELECT_COURIER = `SELECT c.id, c.business_id, c.status, c.work_days, c.off_until,
    c.created_at, c.updated_at, ${PROFILE_COLUMNS}
    FROM couriers c JOIN courier_profiles p ON p.telegram_id = c.telegram_id`

function toProfile(row: ProfileRow): CourierProfile {
    return CourierProfile.reconstitute({
        telegramId: TelegramId.create(row.telegram_id),
        name: row.name,
        phone: row.phone === null ? undefined : Phone.create(row.phone),
        vehicle: optional(row.vehicle),
        shiftUntil: row.shift_until === null ? undefined : new Date(row.shift_until),
        createdAt: new Date(row.profile_created_at),
        updatedAt: new Date(row.profile_updated_at),
    })
}

function toWorkDays(value: string): Weekday[] {
    return value
        .split(",")
        .filter((day) => day.length > 0)
        .map((day) => oneOf(day, WEEKDAYS, "couriers.work_days"))
}

function toCourier(row: CourierRow): Courier {
    return Courier.reconstitute({
        id: row.id,
        businessId: row.business_id,
        profile: toProfile(row),
        status: oneOf(row.status, COURIER_STATUSES, "couriers.status"),
        workDays: toWorkDays(row.work_days),
        offUntil: row.off_until === null ? undefined : new Date(row.off_until),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
}

export class D1CourierRepository implements CourierRepository {
    constructor(private readonly db: D1Database) {}

    async findById(id: string): Promise<Courier | null> {
        const row = await this.db
            .prepare(`${SELECT_COURIER} WHERE c.id = ?`)
            .bind(id)
            .first<CourierRow>()
        return row ? toCourier(row) : null
    }

    async findByTelegramId(businessId: string, telegramId: number): Promise<Courier | null> {
        const row = await this.db
            .prepare(`${SELECT_COURIER} WHERE c.business_id = ? AND c.telegram_id = ?`)
            .bind(businessId, telegramId)
            .first<CourierRow>()
        return row ? toCourier(row) : null
    }

    async listByBusiness(businessId: string): Promise<Courier[]> {
        const { results } = await this.db
            .prepare(
                `${SELECT_COURIER} WHERE c.business_id = ? AND c.status != ?
                 ORDER BY c.created_at`,
            )
            .bind(businessId, CourierStatus.REMOVED)
            .all<CourierRow>()
        return results.map(toCourier)
    }

    async listByPerson(telegramId: number): Promise<Courier[]> {
        const { results } = await this.db
            .prepare(`${SELECT_COURIER} WHERE c.telegram_id = ? ORDER BY c.created_at`)
            .bind(telegramId)
            .all<CourierRow>()
        return results.map(toCourier)
    }

    /**
     * The link. `name`, `phone` and `is_active` are still written: the previous Worker reads them
     * until a later release drops them.
     */
    async save(courier: Courier): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO couriers (id, business_id, telegram_id, name, phone, is_active, status,
                    work_days, off_until, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name, phone = excluded.phone,
                    is_active = excluded.is_active, status = excluded.status,
                    work_days = excluded.work_days, off_until = excluded.off_until,
                    updated_at = excluded.updated_at`,
            )
            .bind(
                courier.id,
                courier.businessId,
                courier.telegramId.value,
                courier.name,
                courier.phone?.number ?? null,
                flag(courier.isActive),
                courier.status,
                courier.workDays.join(","),
                courier.offUntil?.getTime() ?? null,
                courier.createdAt.getTime(),
                courier.updatedAt.getTime(),
            )
            .run()
    }

    async findProfile(telegramId: number): Promise<CourierProfile | null> {
        const row = await this.db
            .prepare(`SELECT ${PROFILE_COLUMNS} FROM courier_profiles p WHERE p.telegram_id = ?`)
            .bind(telegramId)
            .first<ProfileRow>()
        return row ? toProfile(row) : null
    }

    async saveProfile(profile: CourierProfile): Promise<void> {
        const id = profile.telegramId.value
        const phone = profile.phone?.number ?? null
        await this.db.batch([
            this.db
                .prepare(
                    `INSERT INTO courier_profiles (telegram_id, name, phone, vehicle, shift_until,
                        created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (telegram_id) DO UPDATE SET name = excluded.name,
                        phone = excluded.phone, vehicle = excluded.vehicle,
                        shift_until = excluded.shift_until, updated_at = excluded.updated_at`,
                )
                .bind(
                    id,
                    profile.name,
                    phone,
                    profile.vehicle ?? null,
                    profile.shiftUntil?.getTime() ?? null,
                    profile.createdAt.getTime(),
                    profile.updatedAt.getTime(),
                ),
            // The previous Worker reads the name and phone from the shop rows.
            this.db
                .prepare("UPDATE couriers SET name = ?, phone = ? WHERE telegram_id = ?")
                .bind(profile.name, phone, id),
        ])
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
