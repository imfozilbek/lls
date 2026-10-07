import {
    ConflictError,
    BOT_SOURCES,
    BUSINESS_STATUSES,
    BUSINESS_TYPES,
    BusinessStatus,
    BrandColor,
    Business,
    FEATURES,
    Location,
    Money,
    PAYMENT_OPTIONS,
    PayoutCard,
    Phone,
    Slug,
    TelegramId,
    WorkingHours,
} from "@zumda/core"

import { decryptSecret, encryptSecret, randomToken } from "../crypto.js"

import {
    IN_CHUNK,
    Versions,
    bool,
    flag,
    isUniqueViolation,
    oneOf,
    optional,
    placeholders,
} from "./rows.js"

import type { BusinessRepository, WeeklySchedule } from "@zumda/core"

interface BusinessRow {
    id: string
    slug: string
    name: string
    type: string
    owner_telegram_id: number
    status: string
    bot_id: number
    bot_username: string
    bot_source: string
    brand_color: string
    logo_key: string | null
    address: string | null
    latitude: number | null
    longitude: number | null
    delivery_fee: number
    free_delivery_from: number | null
    min_order: number | null
    delivery_radius_m: number | null
    working_hours: string | null
    features: string
    accepting_orders: number
    bottle_deposit: number
    marketplace_commission_bps: number | null
    marketplace_joined_at: number | null
    payout_card_number: string | null
    payout_card_holder: string | null
    payment_card_id: string | null
    contact_phone: string | null
    payment_options: string
    district_id: string | null
    network_delivery: number
    rejected_at: number | null
    review_note: string | null
    owner_chat_open_at: number | null
    owner_chat_closed_at: number | null
    created_at: number
    updated_at: number
}

const COLUMNS = `id, slug, name, type, owner_telegram_id, status, bot_id, bot_username, bot_source,
    brand_color,
    logo_key, address, latitude, longitude, delivery_fee, free_delivery_from, min_order,
    delivery_radius_m, working_hours, features, accepting_orders, bottle_deposit,
    marketplace_commission_bps, marketplace_joined_at, payout_card_number, payout_card_holder,
    district_id, network_delivery, payment_card_id, contact_phone, payment_options, rejected_at,
    review_note, owner_chat_open_at, owner_chat_closed_at, created_at, updated_at`

interface SecretRow {
    bot_id: number
    bot_token_enc: string
    webhook_secret: string
}

export interface BotCredentials {
    botId: number
    token: string
    webhookSecret: string
}

const versions = new Versions<Business>()

function toBusiness(row: BusinessRow): Business {
    return versions.remember(reconstitute(row), row.updated_at)
}

function optionalDate(ms: number | null): Date | undefined {
    return ms === null ? undefined : new Date(ms)
}

function reconstitute(row: BusinessRow): Business {
    const features = (JSON.parse(row.features) as string[]).map((f) =>
        oneOf(f, FEATURES, "feature"),
    )
    return Business.reconstitute({
        id: row.id,
        slug: Slug.create(row.slug),
        name: row.name,
        type: oneOf(row.type, BUSINESS_TYPES, "business type"),
        ownerTelegramId: TelegramId.create(row.owner_telegram_id),
        status: oneOf(row.status, BUSINESS_STATUSES, "business status"),
        bot: { id: row.bot_id, username: row.bot_username },
        botSource: oneOf(row.bot_source, BOT_SOURCES, "bot source"),
        brandColor: BrandColor.create(row.brand_color),
        logoKey: optional(row.logo_key),
        address: optional(row.address),
        location:
            row.latitude === null || row.longitude === null
                ? undefined
                : Location.create(row.latitude, row.longitude),
        delivery: {
            fee: Money.of(row.delivery_fee),
            freeFrom: Money.optional(row.free_delivery_from),
            minOrder: Money.optional(row.min_order),
            radiusMeters: optional(row.delivery_radius_m),
        },
        workingHours: WorkingHours.fromJSON(
            row.working_hours === null ? null : (JSON.parse(row.working_hours) as WeeklySchedule),
        ),
        features,
        acceptingOrders: bool(row.accepting_orders),
        bottleDeposit: Money.of(row.bottle_deposit),
        marketplace:
            row.marketplace_commission_bps === null || row.marketplace_joined_at === null
                ? undefined
                : {
                      commissionBps: row.marketplace_commission_bps,
                      joinedAt: new Date(row.marketplace_joined_at),
                  },
        payoutCard:
            row.payout_card_number === null || row.payout_card_holder === null
                ? undefined
                : PayoutCard.create(row.payout_card_number, row.payout_card_holder),
        paymentCardId: optional(row.payment_card_id),
        contactPhone: row.contact_phone === null ? undefined : Phone.create(row.contact_phone),
        paymentOptions: oneOf(row.payment_options, PAYMENT_OPTIONS, "payment options"),
        districtId: optional(row.district_id),
        networkDelivery: bool(row.network_delivery),
        rejectedAt: row.rejected_at === null ? undefined : new Date(row.rejected_at),
        reviewNote: optional(row.review_note),
        ownerChatOpenAt: optionalDate(row.owner_chat_open_at),
        ownerChatClosedAt: optionalDate(row.owner_chat_closed_at),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
}

function optionalValues(b: Business): (string | number | null)[] {
    const { freeFrom, minOrder, radiusMeters } = b.delivery
    return [
        b.logoKey ?? null,
        b.address ?? null,
        b.location?.latitude ?? null,
        b.location?.longitude ?? null,
        b.delivery.fee.amount,
        freeFrom?.amount ?? null,
        minOrder?.amount ?? null,
        radiusMeters ?? null,
    ]
}

/** `rejected_at`, `review_note`: set only for a rejected application. */
function rejectionValues(b: Business): (string | number | null)[] {
    const rejection = b.rejection
    return [rejection?.at.getTime() ?? null, rejection?.reason ?? null]
}

/** Values for every mutable column, in the order used by INSERT and UPDATE. */
function mutableValues(b: Business): (string | number | null)[] {
    const hours = b.workingHours.toJSON()
    return [
        b.name,
        b.status,
        b.brandColor.hex,
        ...optionalValues(b),
        hours === null ? null : JSON.stringify(hours),
        JSON.stringify(b.features),
        flag(b.acceptingOrders),
        b.bottleDeposit.amount,
        b.marketplace?.commissionBps ?? null,
        b.marketplace?.joinedAt.getTime() ?? null,
        b.payoutCard?.number ?? null,
        b.payoutCard?.holder ?? null,
        b.districtId ?? null,
        flag(b.networkDelivery),
        b.paymentCardId ?? null,
        b.contactPhone?.number ?? null,
        b.paymentOptions,
        ...rejectionValues(b),
        b.updatedAt.getTime(),
    ]
}

export class D1BusinessRepository implements BusinessRepository {
    constructor(
        private readonly db: D1Database,
        private readonly encryptionKey: string,
    ) {}

    /**
     * This request's copies: a use case, the auth and the notifier read the same shop many times
     * (one repository per request, so nothing outlives it).
     */
    private readonly byId = new Map<string, Business | null>()
    /** The token row read together with the shop: the auth needs both, in one query. */
    private readonly secrets = new Map<string, SecretRow>()

    async findById(id: string): Promise<Business | null> {
        if (this.byId.has(id)) {
            return this.byId.get(id) ?? null
        }
        return this.findOne("id = ?", id)
    }

    async findByIds(ids: readonly string[]): Promise<Business[]> {
        const missing = ids.filter((id) => !this.byId.has(id))
        for (let i = 0; i < missing.length; i += IN_CHUNK) {
            const chunk = missing.slice(i, i + IN_CHUNK)
            const { results } = await this.db
                .prepare(
                    `SELECT ${COLUMNS} FROM businesses WHERE id IN (${placeholders(chunk.length)})`,
                )
                .bind(...chunk)
                .all<BusinessRow>()
            for (const row of results) {
                this.byId.set(row.id, toBusiness(row))
            }
        }
        return ids.flatMap((id) => {
            const business = this.byId.get(id)
            return business ? [business] : []
        })
    }

    async findBySlug(slug: string): Promise<Business | null> {
        return this.findOne("slug = ?", slug)
    }

    async findByBotId(botId: number): Promise<Business | null> {
        return this.findOne("bot_id = ?", botId)
    }

    async listByOwner(ownerTelegramId: number): Promise<Business[]> {
        const { results } = await this.db
            .prepare(
                `SELECT ${COLUMNS} FROM businesses WHERE owner_telegram_id = ? ORDER BY created_at`,
            )
            .bind(ownerTelegramId)
            .all<BusinessRow>()
        return results.map(toBusiness)
    }

    async listInShowcase(): Promise<Business[]> {
        const { results } = await this.db
            .prepare(
                `SELECT ${COLUMNS} FROM businesses
                 WHERE marketplace_commission_bps IS NOT NULL AND status = ? ORDER BY name`,
            )
            .bind(BusinessStatus.ACTIVE)
            .all<BusinessRow>()
        return results.map(toBusiness)
    }

    async listByStatus(status: BusinessStatus, limit: number): Promise<Business[]> {
        const { results } = await this.db
            .prepare(
                `SELECT ${COLUMNS} FROM businesses WHERE status = ?
                 ORDER BY created_at DESC LIMIT ?`,
            )
            .bind(status, limit)
            .all<BusinessRow>()
        return results.map(toBusiness)
    }

    async listWithLocation(): Promise<Business[]> {
        const { results } = await this.db
            .prepare(`SELECT ${COLUMNS} FROM businesses WHERE latitude IS NOT NULL ORDER BY id`)
            .all<BusinessRow>()
        return results.map(toBusiness)
    }

    async insert(business: Business, botToken: string): Promise<void> {
        const tokenEncrypted = await encryptSecret(botToken, this.encryptionKey)
        try {
            await this.db
                .prepare(
                    `INSERT INTO businesses (name, status, brand_color, logo_key, address, latitude,
                        longitude, delivery_fee, free_delivery_from, min_order, delivery_radius_m,
                        working_hours, features, accepting_orders, bottle_deposit,
                        marketplace_commission_bps, marketplace_joined_at, payout_card_number,
                        payout_card_holder, district_id, network_delivery, payment_card_id,
                        contact_phone, payment_options, rejected_at, review_note, updated_at,
                        id, slug, type, owner_telegram_id, bot_id, bot_username, bot_token_enc,
                        webhook_secret, created_at, bot_source)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                    ...mutableValues(business),
                    business.id,
                    business.slug.value,
                    business.type,
                    business.ownerTelegramId.value,
                    business.bot.id,
                    business.bot.username,
                    tokenEncrypted,
                    randomToken(),
                    business.createdAt.getTime(),
                    business.botSource,
                )
                .run()
        } catch (error) {
            // The same application sent twice at once: the bot or the address is taken now.
            if (isUniqueViolation(error)) {
                throw String(error).includes("bot_id")
                    ? ConflictError.botAlreadyConnected(business.bot.id)
                    : ConflictError.slugTaken(business.slug.value)
            }
            throw error
        }
        versions.remember(business, business.updatedAt.getTime())
    }

    async replaceBotToken(businessId: string, botToken: string): Promise<void> {
        this.secrets.delete(businessId)
        await this.db
            .prepare("UPDATE businesses SET bot_token_enc = ? WHERE id = ?")
            .bind(await encryptSecret(botToken, this.encryptionKey), businessId)
            .run()
    }

    async saveOwnerChat(business: Business): Promise<void> {
        await this.db
            .prepare(
                "UPDATE businesses SET owner_chat_open_at = ?, owner_chat_closed_at = ? WHERE id = ?",
            )
            .bind(
                business.ownerChatOpenAt?.getTime() ?? null,
                business.ownerChatClosedAt?.getTime() ?? null,
                business.id,
            )
            .run()
    }

    /** Writes only over the version this copy was loaded with: a newer change wins, 409 here. */
    async save(business: Business): Promise<void> {
        const { expected, version } = versions.next(business, business.updatedAt)
        const guard = expected === undefined ? "" : " AND updated_at = ?"
        const values = [...mutableValues(business).slice(0, -1), version]
        const result = await this.db
            .prepare(
                `UPDATE businesses SET name = ?, status = ?, brand_color = ?, logo_key = ?,
                    address = ?, latitude = ?, longitude = ?, delivery_fee = ?,
                    free_delivery_from = ?, min_order = ?, delivery_radius_m = ?,
                    working_hours = ?, features = ?, accepting_orders = ?, bottle_deposit = ?,
                    marketplace_commission_bps = ?, marketplace_joined_at = ?,
                    payout_card_number = ?, payout_card_holder = ?, district_id = ?,
                    network_delivery = ?, payment_card_id = ?, contact_phone = ?,
                    payment_options = ?, rejected_at = ?, review_note = ?,
                    updated_at = ?
                 WHERE id = ?${guard}`,
            )
            .bind(...values, business.id, ...(expected === undefined ? [] : [expected]))
            .run()
        if (result.meta.changes === 0) {
            this.byId.delete(business.id)
            throw ConflictError.stale("business", business.id)
        }
        versions.remember(business, version)
    }

    /** Decrypted bot token and webhook secret. Never return these from the API. */
    async getBotCredentials(businessId: string): Promise<BotCredentials | null> {
        const row =
            this.secrets.get(businessId) ??
            (await this.db
                .prepare(
                    "SELECT bot_id, bot_token_enc, webhook_secret FROM businesses WHERE id = ?",
                )
                .bind(businessId)
                .first<SecretRow>())
        if (!row) {
            return null
        }
        return {
            botId: row.bot_id,
            token: await decryptSecret(row.bot_token_enc, this.encryptionKey),
            webhookSecret: row.webhook_secret,
        }
    }

    private async findOne(where: string, value: string | number): Promise<Business | null> {
        const row = await this.db
            .prepare(
                `SELECT ${COLUMNS}, bot_token_enc, webhook_secret FROM businesses WHERE ${where}`,
            )
            .bind(value)
            .first<BusinessRow & SecretRow>()
        if (!row) {
            return null
        }
        const business = toBusiness(row)
        this.byId.set(row.id, business)
        this.secrets.set(row.id, row)
        return business
    }
}
