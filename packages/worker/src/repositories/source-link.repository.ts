import { SOURCE_LINK_KINDS, ShopChannel, SourceLink } from "@zumda/core"

import { oneOf, optional } from "./rows.js"

import type {
    ShopChannelRepository,
    SourceLinkKind,
    SourceLinkRepository,
    SourceVisit,
} from "@zumda/core"

interface ChannelRow {
    business_id: string
    chat_id: number
    title: string
    username: string | null
    connected_at: number
}

interface LinkRow {
    id: string
    business_id: string
    kind: string
    product_id: string | null
    label: string | null
    chat_id: number | null
    message_id: number | null
    photo_file_id: string | null
    owner_text: string | null
    post_key: string | null
    opens: number
    orders: number
    sales: number
    revenue: number
    created_at: number
    deleted_at: number | null
}

export const CHANNEL_SQL = `SELECT business_id, chat_id, title, username, connected_at
    FROM shop_channels WHERE business_id = ?`

const LINK_COLUMNS = `id, business_id, kind, product_id, label, chat_id, message_id, photo_file_id,
    owner_text, post_key, opens, orders, sales, revenue, created_at, deleted_at`

export const LINK_BY_ID_SQL = `SELECT ${LINK_COLUMNS} FROM source_links
    WHERE id = ? AND business_id = ?`

/** «Telegram kanal» (posts of the channel of now) and «Reklama uchun havolalar»: one page. */
export const LIVE_LINKS_SQL = `SELECT ${LINK_COLUMNS} FROM source_links
    WHERE business_id = ? AND kind = ? AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT ? OFFSET ?`

export const LIVE_CHANNEL_POSTS_SQL = `SELECT ${LINK_COLUMNS} FROM source_links
    WHERE business_id = ? AND kind = ? AND deleted_at IS NULL AND chat_id = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?`

/** Counted up to a limit: never more rows read than the limit. */
export const LIVE_ADS_COUNT_SQL = `SELECT COUNT(*) AS n FROM (
    SELECT 1 FROM source_links
    WHERE business_id = ? AND kind = 'ad' AND deleted_at IS NULL
    LIMIT ?)`

/** A product's name or price changed: its newest live posts in the channel of now. */
export const PRODUCT_POSTS_SQL = `SELECT ${LINK_COLUMNS} FROM source_links
    WHERE business_id = ? AND product_id = ? AND kind = 'post' AND deleted_at IS NULL
      AND chat_id = ?
    ORDER BY created_at DESC LIMIT ?`

/** The link's opens grow only when this person's last visit was not this very link. */
export const VISIT_OPENS_SQL = `UPDATE source_links SET opens = opens + 1
    WHERE id = ? AND business_id = ?
      AND NOT EXISTS (SELECT 1 FROM source_visits
          WHERE business_id = ? AND telegram_id = ? AND link_id = ?)`

export const VISIT_SAVE_SQL = `INSERT INTO source_visits (business_id, telegram_id, link_id, at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (business_id, telegram_id) DO UPDATE SET link_id = excluded.link_id, at = excluded.at`

export const LAST_VISIT_SQL = `SELECT link_id FROM source_visits
    WHERE business_id = ? AND telegram_id = ? AND at >= ?`

function toChannel(row: ChannelRow): ShopChannel {
    return ShopChannel.connect({
        businessId: row.business_id,
        chatId: row.chat_id,
        title: row.title,
        ...(row.username === null ? {} : { username: row.username }),
        connectedAt: new Date(row.connected_at),
    })
}

function toLink(row: LinkRow): SourceLink {
    const post =
        row.chat_id !== null && row.message_id !== null
            ? {
                  chatId: row.chat_id,
                  messageId: row.message_id,
                  ...(row.photo_file_id === null ? {} : { photoFileId: row.photo_file_id }),
              }
            : undefined
    return SourceLink.restore({
        id: row.id,
        businessId: row.business_id,
        kind: oneOf(row.kind, SOURCE_LINK_KINDS, "source_links.kind"),
        productId: optional(row.product_id),
        label: optional(row.label),
        post,
        ownerText: optional(row.owner_text),
        postKey: optional(row.post_key),
        counts: { opens: row.opens, orders: row.orders, sales: row.sales, revenue: row.revenue },
        createdAt: new Date(row.created_at),
        deletedAt: row.deleted_at === null ? undefined : new Date(row.deleted_at),
    })
}

export class D1ShopChannelRepository implements ShopChannelRepository {
    constructor(private readonly db: D1Database) {}

    async find(businessId: string): Promise<ShopChannel | null> {
        const row = await this.db.prepare(CHANNEL_SQL).bind(businessId).first<ChannelRow>()
        return row ? toChannel(row) : null
    }

    async save(channel: ShopChannel): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO shop_channels (business_id, chat_id, title, username, connected_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT (business_id) DO UPDATE SET chat_id = excluded.chat_id,
                    title = excluded.title, username = excluded.username,
                    connected_at = excluded.connected_at`,
            )
            .bind(
                channel.businessId,
                channel.chatId,
                channel.title,
                channel.username ?? null,
                channel.connectedAt.getTime(),
            )
            .run()
    }

    async remove(businessId: string): Promise<void> {
        await this.db
            .prepare("DELETE FROM shop_channels WHERE business_id = ?")
            .bind(businessId)
            .run()
    }
}

export class D1SourceLinkRepository implements SourceLinkRepository {
    constructor(private readonly db: D1Database) {}

    async findById(businessId: string, id: string): Promise<SourceLink | null> {
        const row = await this.db.prepare(LINK_BY_ID_SQL).bind(id, businessId).first<LinkRow>()
        return row ? toLink(row) : null
    }

    async insert(link: SourceLink): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO source_links (id, business_id, kind, product_id, label, chat_id,
                    message_id, photo_file_id, owner_text, post_key, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                link.id,
                link.businessId,
                link.kind,
                link.productId ?? null,
                link.label ?? null,
                link.post?.chatId ?? null,
                link.post?.messageId ?? null,
                link.post?.photoFileId ?? null,
                link.ownerText ?? null,
                link.postKey ?? null,
                link.createdAt.getTime(),
            )
            .run()
    }

    /** Only what changed after: the post's key, or its removal (each index entry counts). */
    async save(link: SourceLink): Promise<void> {
        const statement = link.deletedAt
            ? this.db
                  .prepare(
                      `UPDATE source_links SET deleted_at = ?, post_key = ?
                       WHERE id = ? AND business_id = ? AND deleted_at IS NULL`,
                  )
                  .bind(link.deletedAt.getTime(), link.postKey ?? null, link.id, link.businessId)
            : this.db
                  .prepare("UPDATE source_links SET post_key = ? WHERE id = ? AND business_id = ?")
                  .bind(link.postKey ?? null, link.id, link.businessId)
        await statement.run()
    }

    async listLive(
        businessId: string,
        kind: SourceLinkKind,
        page: { offset: number; limit: number; chatId?: number },
    ): Promise<SourceLink[]> {
        const statement =
            page.chatId === undefined
                ? this.db.prepare(LIVE_LINKS_SQL).bind(businessId, kind, page.limit, page.offset)
                : this.db
                      .prepare(LIVE_CHANNEL_POSTS_SQL)
                      .bind(businessId, kind, page.chatId, page.limit, page.offset)
        const { results } = await statement.all<LinkRow>()
        return results.map(toLink)
    }

    async countLiveAds(businessId: string, atMost: number): Promise<number> {
        const row = await this.db
            .prepare(LIVE_ADS_COUNT_SQL)
            .bind(businessId, atMost)
            .first<{ n: number }>()
        return row?.n ?? 0
    }

    async livePosts(
        businessId: string,
        productId: string,
        chatId: number,
        limit: number,
    ): Promise<SourceLink[]> {
        const { results } = await this.db
            .prepare(PRODUCT_POSTS_SQL)
            .bind(businessId, productId, chatId, limit)
            .all<LinkRow>()
        return results.map(toLink)
    }

    /** One batch: the opens (checked against the visit before it) and then the visit itself. */
    async recordVisit(visit: SourceVisit): Promise<void> {
        await this.db.batch([
            this.db
                .prepare(VISIT_OPENS_SQL)
                .bind(
                    visit.linkId,
                    visit.businessId,
                    visit.businessId,
                    visit.telegramId,
                    visit.linkId,
                ),
            this.db
                .prepare(VISIT_SAVE_SQL)
                .bind(visit.businessId, visit.telegramId, visit.linkId, visit.at.getTime()),
        ])
    }

    async lastVisit(businessId: string, telegramId: number, since: Date): Promise<string | null> {
        const row = await this.db
            .prepare(LAST_VISIT_SQL)
            .bind(businessId, telegramId, since.getTime())
            .first<{ link_id: string }>()
        return row?.link_id ?? null
    }
}
