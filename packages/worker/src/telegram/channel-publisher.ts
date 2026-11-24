import {
    DeleteSourceLinkUseCase,
    PostMedia,
    ImportChannelHistoryUseCase,
    Language,
    PublishPostUseCase,
    RecordChannelPostUseCase,
    SourceLinkKind,
    SyncProductPostsUseCase,
    postHasCaption,
} from "@zumda/core"

import { TelegramApiError } from "./gateway.js"
import { postCaption, postKeyboard } from "./post-caption.js"
import { textsFor } from "./texts.js"

import type { OutgoingFile, OutgoingVideo } from "./gateway.js"
import type { BotTexts } from "./texts.js"
import type { Services } from "../services.js"
import type {
    AttachOutcome,
    Business,
    ChannelPost,
    ChannelPublisher,
    EditOutcome,
    PostFacts,
    PublishOutcome,
    RemoveOutcome,
    ShopChannel,
    SourceLink,
    SourceLinkDeps,
} from "@zumda/core"

/** Telegram's answers when the shop's bot may not post or edit in the channel any more. */
const NO_RIGHTS =
    /not a member|kicked|need administrator rights|not enough rights|have no rights|CHAT_WRITE_FORBIDDEN|CHAT_ADMIN_REQUIRED|chat not found/i
/** Someone deleted the post in Telegram. */
const POST_GONE = /message to edit not found|MESSAGE_ID_INVALID/i
/** The same words again: nothing to change, so nothing was wrong. */
const UNCHANGED = /message is not modified/i
/**
 * The bot is out of the channel, or no longer its admin. Narrower than `NO_RIGHTS`: a button the
 * bot may not put under someone's post («not enough rights») keeps the channel connected.
 */
const LEFT_CHANNEL =
    /not a member|kicked|chat not found|need administrator rights|CHAT_ADMIN_REQUIRED/i
/** Telegram asked to slow down: «Too Many Requests: retry after 35». */
const RETRY_AFTER = /retry after (\d+)/i
/** Telegram answered (and said no): anything else is a failure to reach it, tried again later. */
const TELEGRAM_SAID_NO = /Bad Request|Forbidden|rights|REQUIRED|EXPIRED/i

/** What Telegram's no to a button under the owner's post means. */
function attachRefusal(error: unknown): AttachOutcome {
    if (!(error instanceof TelegramApiError)) {
        throw error
    }
    const text = error.description
    const wait = RETRY_AFTER.exec(text)
    if (wait) {
        return { kind: "wait", seconds: Number(wait[1]) }
    }
    if (UNCHANGED.test(text)) {
        return { kind: "attached" }
    }
    if (POST_GONE.test(text)) {
        return { kind: "gone" }
    }
    if (LEFT_CHANNEL.test(text)) {
        return { kind: "noRights" }
    }
    if (TELEGRAM_SAID_NO.test(text)) {
        return { kind: "refused" }
    }
    throw error
}

function said(error: unknown, pattern: RegExp): boolean {
    return error instanceof TelegramApiError && pattern.test(error.description)
}

/**
 * What a new post carries above its words: the picture the app drew (one photo or a collage, a
 * JPEG: Telegram may refuse the WebP the catalog keeps), or a video from the owner's phone.
 */
export type PostUpload =
    { kind: "photo"; file: OutgoingFile } | { kind: "video"; video: OutgoingVideo }

/** The shop's channel through its own bot. */
export class TelegramChannelPublisher implements ChannelPublisher {
    constructor(
        private readonly services: Services,
        private readonly business: Business,
        private readonly upload: PostUpload | null = null,
    ) {}

    /** A channel speaks to everyone: Uzbek, like every Zumda text. */
    private get texts(): BotTexts {
        return textsFor(Language.UZ, this.business.type)
    }

    /** Read and decrypted once a request: the past's ten buttons need it ten times. */
    private tokenOnce: Promise<string> | undefined

    private token(): Promise<string> {
        this.tokenOnce ??= this.services.businesses
            .getBotCredentials(this.business.id)
            .then((credentials) => {
                if (!credentials) {
                    throw new Error(`No bot credentials for shop ${this.business.id}`)
                }
                return credentials.token
            })
        return this.tokenOnce
    }

    /** Read once a request: whether the shop answers questions (its support group). */
    private asksOnce: Promise<boolean> | undefined

    private async keyboard(linkId: string): Promise<ReturnType<typeof postKeyboard>> {
        this.asksOnce ??= this.services.supportGroups
            .find(this.business.id)
            .then((group) => group !== null)
        const asks = await this.asksOnce
        return postKeyboard(this.business.bot.username, linkId, this.texts, asks)
    }

    async publish(channel: ShopChannel, post: ChannelPost): Promise<PublishOutcome> {
        const token = await this.token()
        const caption = postCaption(post.facts, post.ownerText, this.texts)
        const options = { keyboard: await this.keyboard(post.linkId) }
        try {
            const telegram = this.services.telegram
            if (this.upload?.kind === "video") {
                const sent = await telegram.sendVideoFile(
                    token,
                    channel.chatId,
                    this.upload.video,
                    caption,
                    options,
                )
                const ref = { chatId: channel.chatId, ...sent, media: PostMedia.VIDEO }
                return { kind: "posted", ref }
            }
            if (this.upload) {
                const sent = await telegram.sendPhotoFile(
                    token,
                    channel.chatId,
                    this.upload.file,
                    caption,
                    options,
                )
                const ref = { chatId: channel.chatId, ...sent, media: PostMedia.PHOTO }
                return { kind: "posted", ref }
            }
            const sent = await this.services.telegram.sendMessage(
                token,
                channel.chatId,
                caption,
                options,
            )
            return { kind: "posted", ref: { chatId: channel.chatId, messageId: sent.messageId } }
        } catch (error) {
            if (said(error, NO_RIGHTS)) {
                return { kind: "noRights" }
            }
            throw error
        }
    }

    async edit(channel: ShopChannel, link: SourceLink, facts: PostFacts): Promise<EditOutcome> {
        const post = link.post
        if (!post) {
            return "gone"
        }
        const token = await this.token()
        const caption = postCaption(facts, link.ownerText, this.texts)
        const options = { keyboard: await this.keyboard(link.id) }
        try {
            if (postHasCaption(post)) {
                await this.services.telegram.editCaption(
                    token,
                    channel.chatId,
                    post.messageId,
                    caption,
                    options,
                )
            } else {
                await this.services.telegram.editMessage(
                    token,
                    channel.chatId,
                    post.messageId,
                    caption,
                    options,
                )
            }
            return "edited"
        } catch (error) {
            if (said(error, UNCHANGED)) {
                return "edited"
            }
            if (said(error, POST_GONE)) {
                return "gone"
            }
            if (said(error, NO_RIGHTS)) {
                return "noRights"
            }
            throw error
        }
    }

    /** «Buyurtma berish» under a post the owner made in Telegram; their words stay. */
    async attachButton(channel: ShopChannel, link: SourceLink): Promise<AttachOutcome> {
        if (!link.post) {
            return { kind: "gone" }
        }
        try {
            await this.services.telegram.setButtons(
                await this.token(),
                channel.chatId,
                link.post.messageId,
                await this.keyboard(link.id),
            )
            return { kind: "attached" }
        } catch (error) {
            return attachRefusal(error)
        }
    }

    async remove(channel: ShopChannel, link: SourceLink): Promise<RemoveOutcome> {
        if (!link.post) {
            return "removed"
        }
        try {
            return await this.services.telegram.deleteChannelPost(
                await this.token(),
                channel.chatId,
                link.post.messageId,
            )
        } catch (error) {
            if (said(error, NO_RIGHTS)) {
                return "refused"
            }
            throw error
        }
    }
}

function linkDeps(services: Services): SourceLinkDeps {
    return {
        businesses: services.businesses,
        products: services.products,
        channels: services.shopChannels,
        links: services.sourceLinks,
    }
}

export function publishPostUseCase(
    services: Services,
    business: Business,
    upload: PostUpload | null,
): PublishPostUseCase {
    const publisher = new TelegramChannelPublisher(services, business, upload)
    return new PublishPostUseCase({ ...linkDeps(services), publisher })
}

export function deleteSourceLinkUseCase(
    services: Services,
    business: Business,
): DeleteSourceLinkUseCase {
    const publisher = new TelegramChannelPublisher(services, business)
    return new DeleteSourceLinkUseCase({ ...linkDeps(services), publisher })
}

/** A post the owner made in Telegram joins Zumda with «Buyurtma berish». */
export function recordChannelPostUseCase(
    services: Services,
    business: Business,
): RecordChannelPostUseCase {
    const publisher = new TelegramChannelPublisher(services, business)
    return new RecordChannelPostUseCase({ ...linkDeps(services), publisher })
}

/** «Eski postlarni qo'shish»: one page of the channel's past a request. */
export function importChannelHistoryUseCase(
    services: Services,
    business: Business,
): ImportChannelHistoryUseCase {
    const publisher = new TelegramChannelPublisher(services, business)
    return new ImportChannelHistoryUseCase({
        ...linkDeps(services),
        publisher,
        history: services.history,
    })
}

/** The product's name, price or age changed: its posts say it too (in the background). */
export async function syncProductPosts(
    services: Services,
    business: Business,
    productId: string,
): Promise<void> {
    const publisher = new TelegramChannelPublisher(services, business)
    await new SyncProductPostsUseCase({ ...linkDeps(services), publisher }).execute({
        businessId: business.id,
        productId,
        now: services.clock.now(),
    })
}

/** The newest posts whose buttons follow the support group (goal 23). */
export const POSTS_REBUTTONED = 20

/**
 * The shop's support group came or went: the newest posts with buttons get «💬 Savolim bor», or
 * lose it. One post Telegram refuses (deleted, too old) leaves the others as they go.
 */
export async function refreshPostButtons(services: Services, business: Business): Promise<void> {
    const channel = await services.shopChannels.find(business.id)
    if (!channel) {
        return
    }
    const posts = await services.sourceLinks.listLive(business.id, SourceLinkKind.POST, {
        offset: 0,
        limit: POSTS_REBUTTONED,
        chatId: channel.chatId,
    })
    const publisher = new TelegramChannelPublisher(services, business)
    for (const link of posts) {
        if (!link.hasButton) {
            continue
        }
        const outcome = await publisher.attachButton(channel, link).catch((error: unknown) => {
            console.warn("Post buttons not refreshed", String(error))
            return { kind: "refused" } as const
        })
        if (outcome.kind === "noRights" || outcome.kind === "wait") {
            return
        }
    }
}
