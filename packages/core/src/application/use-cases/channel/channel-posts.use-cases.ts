import { SourceLink } from "../../../domain/entities/source-link.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { guessPostProduct } from "../../../domain/services/post-guess.js"
import { toSourceLinkDTO } from "../../dtos/source-link.dto.js"
import { requireOwnedBusiness } from "../shared.js"

import { requirePromotable } from "./shop-channel.use-cases.js"

import type { SourceLinkDeps } from "./source-links.use-cases.js"
import type { NamedProduct } from "../../../domain/services/post-guess.js"
import type { ShopChannel } from "../../../domain/value-objects/shop-channel.js"
import type { SourceLinkDTO } from "../../dtos/source-link.dto.js"
import type {
    AttachOutcome,
    ChannelHistoryReader,
    ChannelPublisher,
    HistoryPost,
} from "../../ports/source-links.js"

/** Older posts written per request: one page read and this many buttons, within a request. */
export const HISTORY_BATCH = 10

type ChannelPostDeps = SourceLinkDeps & { publisher: ChannelPublisher }

/** What became of one post of the owner's: in Zumda (with or without its button), or not. */
type Recorded =
    | { kind: "recorded"; link: SourceLink }
    /** In Zumda already, or nothing to keep (an album without words: no button, no text). */
    | { kind: "skipped" }
    | { kind: "gone" }
    | { kind: "noRights" }
    | { kind: "wait"; seconds: number }

/**
 * The owner's post goes into Zumda: the product its text names (or the whole shop), and
 * «Buyurtma berish» under it. The button is put first and the row written after, so a post
 * Telegram asked to wait for is tried again whole; an album or a post Telegram will not let the
 * bot change is kept without a button.
 */
interface PostToRecord {
    post: HistoryPost
    catalog: readonly NamedProduct[]
    now: Date
    /** False: kept without a button, not tried (Telegram asked to wait a moment ago). */
    attach?: boolean
}

/** The owner's post as a link of Zumda's: the product its words name, or the whole shop. */
function linkOf(
    channel: ShopChannel,
    post: HistoryPost,
    productId: string | undefined,
    now: Date,
): SourceLink {
    return SourceLink.channelPost({
        businessId: channel.businessId,
        ref: { chatId: channel.chatId, messageId: post.messageId },
        ...(productId === undefined ? {} : { productId }),
        ...(post.text === undefined ? {} : { text: post.text }),
        now: post.date ?? now,
    })
}

/**
 * The same post twice at once (Telegram sent it again, or the past was being read): the button
 * carries the code that was written, not this one.
 */
async function buttonOfWritten(
    deps: ChannelPostDeps,
    channel: ShopChannel,
    messageId: number,
): Promise<void> {
    const stored = await deps.links.findByPost(channel.chatId, messageId)
    if (stored) {
        await deps.publisher.attachButton(channel, stored)
    }
}

async function recordPost(
    deps: ChannelPostDeps,
    channel: ShopChannel,
    { post, catalog, now, attach = true }: PostToRecord,
): Promise<Recorded> {
    if (post.album && !post.text) {
        return { kind: "skipped" }
    }
    const link = linkOf(channel, post, guessPostProduct(post.text, catalog), now)
    const outcome: AttachOutcome =
        post.album || !attach
            ? { kind: "refused" }
            : await deps.publisher.attachButton(channel, link)
    if (outcome.kind === "gone" || outcome.kind === "noRights" || outcome.kind === "wait") {
        return outcome
    }
    const attached = outcome.kind === "attached"
    if (attached) {
        link.buttonAttached(now)
    }
    if (await deps.links.insertChannelPost(link)) {
        return { kind: "recorded", link }
    }
    if (attached) {
        await buttonOfWritten(deps, channel, post.messageId)
    }
    return { kind: "skipped" }
}

/**
 * Telegram brought a post of a channel (owner's decision, November 2026: every post of the
 * shop's channel is in Zumda, with «Buyurtma berish» at once). Only the shop's connected channel
 * counts; a post Zumda knows (its own, or one seen before) is left alone.
 */
export class RecordChannelPostUseCase {
    constructor(private readonly deps: ChannelPostDeps) {}

    async execute(input: {
        businessId: string
        chatId: number
        messageId: number
        text?: string
        album: boolean
        /** When Telegram says it was posted. */
        date?: Date
        now: Date
    }): Promise<SourceLink | null> {
        const { channels, links, products } = this.deps
        const channel = await channels.find(input.businessId)
        if (!channel?.isSameChat(input.chatId)) {
            return null
        }
        if ((await links.knownPosts(input.chatId, [input.messageId])).size > 0) {
            return null
        }
        const catalog = await products.catalogNames(input.businessId)
        const post: HistoryPost = {
            messageId: input.messageId,
            album: input.album,
            ...(input.text === undefined ? {} : { text: input.text }),
            ...(input.date === undefined ? {} : { date: input.date }),
        }
        const toRecord = { post, catalog, now: input.now }
        let recorded = await recordPost(this.deps, channel, toRecord)
        if (recorded.kind === "wait") {
            // A busy moment of Telegram's: the post is kept, its button is not.
            recorded = await recordPost(this.deps, channel, { ...toRecord, attach: false })
        }
        // The bot out of the channel: Telegram's `my_chat_member` disconnects it and tells the
        // owner, so this post is only left alone.
        return recorded.kind === "recorded" ? recorded.link : null
    }
}

/**
 * «Mahsulotni tanlash»: the owner's post leads to another product, or to the whole shop. Only a
 * post made in Telegram: a Zumda post's caption names its product.
 */
export class RelinkChannelPostUseCase {
    constructor(private readonly deps: SourceLinkDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        linkId: string
        productId?: string
    }): Promise<SourceLinkDTO> {
        const { businesses, products, channels, links } = this.deps
        await requireOwnedBusiness(businesses, input.businessId, input.actorTelegramId)
        const link = await links.findById(input.businessId, input.linkId)
        if (!link?.isLive) {
            throw EntityNotFoundError.sourceLink(input.linkId)
        }
        if (!link.isChannelPost) {
            throw BusinessRuleViolationError.postNotRelinkable(link.id)
        }
        if (input.productId !== undefined) {
            const product = await products.findById(input.productId)
            if (!product?.belongsTo(input.businessId)) {
                throw EntityNotFoundError.product(input.productId)
            }
        }
        link.relink(input.productId)
        await links.saveProduct(link)
        return toSourceLinkDTO(link, await channels.find(input.businessId))
    }
}

/** One request of «Eski postlarni qo'shish». */
export type HistoryOutcome =
    /** A private channel, or its page could not be read: only new posts come. */
    | { kind: "unavailable"; added: number }
    | { kind: "more"; added: number }
    | { kind: "done"; added: number }
    /** Telegram asked to slow down: the app presses again in `seconds`. */
    | { kind: "wait"; added: number; seconds: number }

/**
 * «Eski postlarni qo'shish» (owner's decision, November 2026: the bot reads the past itself).
 * Telegram gives a bot no history, so a public channel's own web page is read, one page a
 * request, newest first; at most `HISTORY_BATCH` new posts get their button, and where it
 * stopped is kept, so the owner may leave and come back. Posts Zumda knows are passed over.
 */
export class ImportChannelHistoryUseCase {
    constructor(private readonly deps: ChannelPostDeps & { history: ChannelHistoryReader }) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        now: Date
    }): Promise<HistoryOutcome> {
        const { businesses, channels, history, links, products } = this.deps
        const business = await requireOwnedBusiness(
            businesses,
            input.businessId,
            input.actorTelegramId,
        )
        requirePromotable(business)
        const channel = await channels.find(business.id)
        if (!channel) {
            throw BusinessRuleViolationError.channelNotConnected(business.id)
        }
        if (channel.historyDone) {
            return { kind: "done", added: 0 }
        }
        const page = channel.username
            ? await history.page(channel.username, channel.historyBefore)
            : null
        if (!page) {
            return { kind: "unavailable", added: 0 }
        }
        const known = await links.knownPosts(
            channel.chatId,
            page.posts.map((post) => post.messageId),
        )
        const fresh = page.posts.filter((post) => !known.has(post.messageId))
        const catalog = fresh.length > 0 ? await products.catalogNames(business.id) : []
        return this.walk(channel, page.posts, { known, catalog, older: page.older }, input.now)
    }

    /** Down the page: new posts up to the batch, then where the next request starts. */
    private async walk(
        channel: ShopChannel,
        posts: readonly HistoryPost[],
        page: { known: Set<number>; catalog: readonly NamedProduct[]; older: boolean },
        now: Date,
    ): Promise<HistoryOutcome> {
        let added = 0
        for (const post of posts) {
            if (page.known.has(post.messageId)) {
                continue
            }
            if (added === HISTORY_BATCH) {
                return this.stopAt(channel, post.messageId + 1, { kind: "more", added })
            }
            const recorded = await recordPost(this.deps, channel, {
                post,
                catalog: page.catalog,
                now,
            })
            if (recorded.kind === "noRights") {
                await this.deps.channels.remove(channel.businessId)
                throw BusinessRuleViolationError.channelNoRights(channel.businessId)
            }
            if (recorded.kind === "wait") {
                const wait = { kind: "wait", added, seconds: recorded.seconds } as const
                return this.stopAt(channel, post.messageId + 1, wait)
            }
            if (recorded.kind === "recorded") {
                added += 1
            }
        }
        const last = posts.at(-1)
        if (!page.older || !last) {
            await this.deps.channels.save(channel.withHistory({ doneAt: now }))
            return { kind: "done", added }
        }
        return this.stopAt(channel, last.messageId, { kind: "more", added })
    }

    private async stopAt(
        channel: ShopChannel,
        before: number,
        outcome: HistoryOutcome,
    ): Promise<HistoryOutcome> {
        await this.deps.channels.save(channel.withHistory({ before }))
        return outcome
    }
}
