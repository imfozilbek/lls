import type { SourceLink, SourceLinkKind } from "../../domain/entities/source-link.js"
import type { ShopChannel } from "../../domain/value-objects/shop-channel.js"

/** A post or an ad link with what it brought, for «Telegram kanal» and «Reklama uchun havolalar». */
export interface SourceLinkDTO {
    id: string
    kind: SourceLinkKind
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

export interface ShopChannelDTO {
    title: string
    username?: string
    connectedAt: string
}

export function toSourceLinkDTO(link: SourceLink, channel?: ShopChannel | null): SourceLinkDTO {
    const counts = link.counts
    const post = link.post
    const postUrl =
        post && channel?.isSameChat(post.chatId) ? channel.postUrl(post.messageId) : undefined
    return {
        id: link.id,
        kind: link.kind,
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
    }
}
