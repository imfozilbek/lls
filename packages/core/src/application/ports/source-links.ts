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
    /** A post made in Telegram; false when that post is in Zumda already (written once). */
    insertChannelPost(link: SourceLink): Promise<boolean>
    /** Which of these posts of the channel Zumda knows already. */
    knownPosts(chatId: number, messageIds: readonly number[]): Promise<Set<number>>
    /** The link of a post of the channel, whoever made it. */
    findByPost(chatId: number, messageId: number): Promise<SourceLink | null>
    /** The owner's post leads to another product, or to the whole shop. */
    saveProduct(link: SourceLink): Promise<void>
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
 * «Buyurtma berish» under the owner's post: `refused` (Telegram does not let the bot change that
 * post, or it is an album), `gone` (deleted), `noRights`, or `wait` (too fast: again in `seconds`).
 */
export type AttachOutcome =
    | { kind: "attached" }
    | { kind: "refused" }
    | { kind: "gone" }
    | { kind: "noRights" }
    | { kind: "wait"; seconds: number }

/** One post of the channel's past, as its public web page shows it. */
export interface HistoryPost {
    messageId: number
    text?: string
    /** Several photos in one post: Telegram shows no button under it. */
    album: boolean
    /** When it was posted: the list keeps the channel's own order. */
    date?: Date
}

/** A page of older posts, newest first; `older`: more come before the last one. */
export interface HistoryPage {
    posts: HistoryPost[]
    older: boolean
}

/**
 * The past of a public channel. Telegram gives a bot no history, so it is read from the
 * channel's own web page (`t.me/s/<username>`): null when Telegram does not show it (a private
 * channel, its page turned off); a passing failure to reach it throws.
 */
export interface ChannelHistoryReader {
    page(username: string, before?: number): Promise<HistoryPage | null>
}
/**
 * The shop's channel as Telegram sees it (the Worker). A passing failure throws; what Telegram
 * says about the post or the bot's rights comes back as an outcome.
 */
export interface ChannelPublisher {
    publish(channel: ShopChannel, post: ChannelPost): Promise<PublishOutcome>
    edit(channel: ShopChannel, link: SourceLink, facts: PostFacts): Promise<EditOutcome>
    remove(channel: ShopChannel, link: SourceLink): Promise<RemoveOutcome>
    /** Puts «Buyurtma berish» (the link's code) under a post the owner made in Telegram. */
    attachButton(channel: ShopChannel, link: SourceLink): Promise<AttachOutcome>
}
