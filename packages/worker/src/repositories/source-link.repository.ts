import {
    POST_MEDIA,
    SOURCE_LINK_KINDS,
    SOURCE_LINK_ORIGINS,
    ShopChannel,
    SourceLink,
} from "@zumda/core"

import { oneOf, optional, placeholders } from "./rows.js"

import type {
    PostRef,
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
    updates_version: number
    history_before: number | null
    history_done_at: number | null
}

interface LinkRow {
    id: string
    business_id: string
    kind: string
    origin: string
    preview: string | null
    button_at: number | null
    product_id: string | null
    label: string | null
    chat_id: number | null
    message_id: number | null
    photo_file_id: string | null
    post_media: string | null
    owner_text: string | null
    post_key: string | null
    opens: number
    orders: number
    sales: number
    revenue: number
    created_at: number
    deleted_at: number | null
}

export const CHANNEL_SQL = `SELECT business_id, chat_id, title, username, connected_at,
    updates_version, history_before, history_done_at
    FROM shop_channels WHERE business_id = ?`

const LINK_COLUMNS = `id, business_id, kind, origin, preview, button_at, product_id, label, chat_id,
    message_id, photo_file_id, post_media, owner_text, post_key, opens, orders, sales, revenue, created_at,
    deleted_at`

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

/**
 * A product's name or price changed: Zumda's own newest live posts of it in the channel of now
 * (the owner's posts made in Telegram keep their words).
 */
export const PRODUCT_POSTS_SQL = `SELECT ${LINK_COLUMNS} FROM source_links
    WHERE business_id = ? AND product_id = ? AND kind = 'post' AND deleted_at IS NULL
      AND chat_id = ? AND origin = 'zumda'
    ORDER BY created_at DESC LIMIT ?`

/** The posts of a channel Zumda knows, among these (the unique index of a post). */
export function knownPostsSql(count: number): string {
    return `SELECT message_id FROM source_links
    WHERE chat_id = ? AND message_id IN (${placeholders(count)}) AND message_id IS NOT NULL`
}

/** One post of a channel, by the unique index of a post. */
export const POST_LINK_SQL = `SELECT ${LINK_COLUMNS} FROM source_links
    WHERE chat_id = ? AND message_id = ? AND message_id IS NOT NULL`

const LINK_INSERT = `INSERT INTO source_links (id, business_id, kind, origin, preview, button_at,
    product_id, label, chat_id, message_id, photo_file_id, post_media, owner_text, post_key,
    created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

/** A post made in Telegram: written once, however often it is seen. */
export const CHANNEL_POST_INSERT = `${LINK_INSERT}
    ON CONFLICT (chat_id, message_id) WHERE message_id IS NOT NULL DO NOTHING`

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
        updatesVersion: row.updates_version,
        ...(row.history_before === null ? {} : { historyBefore: row.history_before }),
        ...(row.history_done_at === null ? {} : { historyDoneAt: new Date(row.history_done_at) }),
    })
}

/** Where a post is in its channel and what it carries; an ad link has none of it. */
function postColumns(post: PostRef | undefined): (string | number | null)[] {
    return post
        ? [post.chatId, post.messageId, post.photoFileId ?? null, post.media ?? null]
        : [null, null, null, null]
}

function toLink(row: LinkRow): SourceLink {
    const post =
        row.chat_id !== null && row.message_id !== null
            ? {
                  chatId: row.chat_id,
                  messageId: row.message_id,
                  ...(row.photo_file_id === null ? {} : { photoFileId: row.photo_file_id }),
                  ...(row.post_media === null
                      ? {}
                      : { media: oneOf(row.post_media, POST_MEDIA, "source_links.post_media") }),
              }
            : undefined
    return SourceLink.restore({
        id: row.id,
        businessId: row.business_id,
        kind: oneOf(row.kind, SOURCE_LINK_KINDS, "source_links.kind"),
        origin: oneOf(row.origin, SOURCE_LINK_ORIGINS, "source_links.origin"),
        preview: optional(row.preview),
        buttonAt: row.button_at === null ? undefined : new Date(row.button_at),
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
                `INSERT INTO shop_channels (business_id, chat_id, title, username, connected_at,
                    updates_version, history_before, history_done_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (business_id) DO UPDATE SET chat_id = excluded.chat_id,
                    title = excluded.title, username = excluded.username,
                    connected_at = excluded.connected_at,
                    updates_version = excluded.updates_version,
                    history_before = excluded.history_before,
                    history_done_at = excluded.history_done_at`,
            )
            .bind(
                channel.businessId,
                channel.chatId,
                channel.title,
                channel.username ?? null,
                channel.connectedAt.getTime(),
                channel.updatesVersion,
                channel.historyBefore ?? null,
                channel.historyDoneAt?.getTime() ?? null,
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

    private bindLink(sql: string, link: SourceLink): D1PreparedStatement {
        return this.db
            .prepare(sql)
            .bind(
                link.id,
                link.businessId,
                link.kind,
                link.origin,
                link.preview ?? null,
                link.buttonAt?.getTime() ?? null,
                link.productId ?? null,
                link.label ?? null,
                ...postColumns(link.post),
                link.ownerText ?? null,
                link.postKey ?? null,
                link.createdAt.getTime(),
            )
    }

    async insert(link: SourceLink): Promise<void> {
        await this.bindLink(LINK_INSERT, link).run()
    }

    async insertChannelPost(link: SourceLink): Promise<boolean> {
        const { meta } = await this.bindLink(CHANNEL_POST_INSERT, link).run()
        return meta.changes > 0
    }

    async knownPosts(chatId: number, messageIds: readonly number[]): Promise<Set<number>> {
        if (messageIds.length === 0) {
            return new Set()
        }
        const { results } = await this.db
            .prepare(knownPostsSql(messageIds.length))
            .bind(chatId, ...messageIds)
            .all<{ message_id: number }>()
        return new Set(results.map((row) => row.message_id))
    }

    async findByPost(chatId: number, messageId: number): Promise<SourceLink | null> {
        const row = await this.db.prepare(POST_LINK_SQL).bind(chatId, messageId).first<LinkRow>()
        return row ? toLink(row) : null
    }

    /** Only the product: the owner's post leads elsewhere, its button keeps its code. */
    async saveProduct(link: SourceLink): Promise<void> {
        await this.db
            .prepare("UPDATE source_links SET product_id = ? WHERE id = ? AND business_id = ?")
            .bind(link.productId ?? null, link.id, link.businessId)
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
