import type { PostRef, SourceLink, SourceLinkKind } from "../../domain/entities/source-link.js"
import type { PostFacts } from "../../domain/services/post-facts.js"
import type { ShopChannel } from "../../domain/value-objects/shop-channel.js"

export interface ShopChannelRepository {
    find(businessId: string): Promise<ShopChannel | null>
    /** Connects it, replacing the one before. */
    save(channel: ShopChannel): Promise<void>
    remove(businessId: string): Promise<void>
}

/** Someone pressed a link of the shop: the last one wins. */
export interface SourceVisit {
    businessId: string
    telegramId: number
    linkId: string
    at: Date
}

export interface SourceLinkRepository {
    findById(businessId: string, id: string): Promise<SourceLink | null>
    insert(link: SourceLink): Promise<void>
    /** Writes what may change after it was made: the post's key and its removal. */
    save(link: SourceLink): Promise<void>
    /** Live links of one kind, newest first; posts only of `chatId` when given. */
    listLive(
        businessId: string,
        kind: SourceLinkKind,
        page: { offset: number; limit: number; chatId?: number },
    ): Promise<SourceLink[]>
    /** Live ad links, counted up to `atMost` (never more rows than that are read). */
    countLiveAds(businessId: string, atMost: number): Promise<number>
    /** A product's newest live posts in that channel. */
    livePosts(
        businessId: string,
        productId: string,
        chatId: number,
        limit: number,
    ): Promise<SourceLink[]>
    /** Keeps the visit; the link's opens grow only when this person's last visit was another. */
    recordVisit(visit: SourceVisit): Promise<void>
    /** The link this person pressed last, if not before `since`. */
    lastVisit(businessId: string, telegramId: number, since: Date): Promise<string | null>
}

/** A product post to send: the code goes into its button. */
export interface ChannelPost {
    linkId: string
    facts: PostFacts
    ownerText?: string
}

export type PublishOutcome = { kind: "posted"; ref: PostRef } | { kind: "noRights" }

/** `gone`: someone deleted the post in Telegram; `noRights`: the bot may not edit there now. */
export type EditOutcome = "edited" | "gone" | "noRights"

/** `refused`: Telegram did not delete it (the post stays). */
export type RemoveOutcome = "removed" | "refused"

/**
 * The shop's channel as Telegram sees it (the Worker). A passing failure throws; what Telegram
 * says about the post or the bot's rights comes back as an outcome.
 */
export interface ChannelPublisher {
    publish(channel: ShopChannel, post: ChannelPost): Promise<PublishOutcome>
    edit(channel: ShopChannel, link: SourceLink, facts: PostFacts): Promise<EditOutcome>
    remove(channel: ShopChannel, link: SourceLink): Promise<RemoveOutcome>
}
