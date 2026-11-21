import type {
    SourceLink,
    SourceLinkKind,
    SourceLinkOrigin,
} from "../../domain/entities/source-link.js"
import type { ShopChannel } from "../../domain/value-objects/shop-channel.js"

/** A post or an ad link with what it brought, for «Telegram kanal» and «Reklama uchun havolalar». */
export interface SourceLinkDTO {
    id: string
    kind: SourceLinkKind
    /** A post: made by Zumda, or by the owner in Telegram. */
    origin: SourceLinkOrigin
    /** A post made in Telegram: its first words. */
    preview?: string
    /** «Buyurtma berish» is under the post (an ad link: always true). */
    button: boolean
    productId?: string
    label?: string
    /** The post in Telegram, for «Postni ko'rish». */
    postUrl?: string
    /** People who pressed it (each once; the owner never counts). */
    opens: number
    orders: number
    /** Delivered orders, and their goods in integer UZS. */
    sales: number
    revenue: number
    createdAt: string
}

/**
 * «Eski postlar»: `open` the bot may read the channel's past (a public channel), `done` it read
 * it to the first post, `unavailable` a private channel (only new posts come).
 */
export type ChannelHistoryState = "open" | "done" | "unavailable"

export interface ShopChannelDTO {
    title: string
    username?: string
    connectedAt: string
    history: ChannelHistoryState
}

function historyOf(channel: ShopChannel): ChannelHistoryState {
    if (channel.historyDone) {
        return "done"
    }
    return channel.isPublic ? "open" : "unavailable"
}

export function toSourceLinkDTO(link: SourceLink, channel?: ShopChannel | null): SourceLinkDTO {
    const counts = link.counts
    const post = link.post
    const postUrl =
        post && channel?.isSameChat(post.chatId) ? channel.postUrl(post.messageId) : undefined
    return {
        id: link.id,
        kind: link.kind,
        origin: link.origin,
        ...(link.preview === undefined ? {} : { preview: link.preview }),
        button: !link.isChannelPost || link.hasButton,
        ...(link.productId === undefined ? {} : { productId: link.productId }),
        ...(link.label === undefined ? {} : { label: link.label }),
        ...(postUrl === undefined ? {} : { postUrl }),
        opens: counts.opens,
        orders: counts.orders,
        sales: counts.sales,
        revenue: counts.revenue,
        createdAt: link.createdAt.toISOString(),
    }
}

export function toShopChannelDTO(channel: ShopChannel): ShopChannelDTO {
    return {
        title: channel.title,
        ...(channel.username === undefined ? {} : { username: channel.username }),
        connectedAt: channel.connectedAt.toISOString(),
        history: historyOf(channel),
    }
}
