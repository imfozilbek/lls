import {
    DeleteSourceLinkUseCase,
    Language,
    PublishPostUseCase,
    SyncProductPostsUseCase,
} from "@zumda/core"

import { TelegramApiError } from "./gateway.js"
import { postCaption, postKeyboard } from "./post-caption.js"
import { textsFor } from "./texts.js"

import type { OutgoingFile } from "./gateway.js"
import type { BotTexts } from "./texts.js"
import type { Services } from "../services.js"
import type {
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

function said(error: unknown, pattern: RegExp): boolean {
    return error instanceof TelegramApiError && pattern.test(error.description)
}

/**
 * The shop's channel through its own bot. `photo` is the picture the app drew for a new post (a
 * JPEG: Telegram may refuse the WebP the catalog keeps).
 */
export class TelegramChannelPublisher implements ChannelPublisher {
    constructor(
        private readonly services: Services,
        private readonly business: Business,
        private readonly photo: OutgoingFile | null = null,
    ) {}

    /** A channel speaks to everyone: Uzbek, like every Zumda text. */
    private get texts(): BotTexts {
        return textsFor(Language.UZ, this.business.type)
    }

    private async token(): Promise<string> {
        const credentials = await this.services.businesses.getBotCredentials(this.business.id)
        if (!credentials) {
            throw new Error(`No bot credentials for shop ${this.business.id}`)
        }
        return credentials.token
    }

    private keyboard(linkId: string): ReturnType<typeof postKeyboard> {
        return postKeyboard(this.business.bot.username, linkId, this.texts)
    }

    async publish(channel: ShopChannel, post: ChannelPost): Promise<PublishOutcome> {
        const token = await this.token()
        const caption = postCaption(post.facts, post.ownerText, this.texts)
        const options = { keyboard: this.keyboard(post.linkId) }
        try {
            if (this.photo) {
                const sent = await this.services.telegram.sendPhotoFile(
                    token,
                    channel.chatId,
                    this.photo,
                    caption,
                    options,
                )
                return { kind: "posted", ref: { chatId: channel.chatId, ...sent } }
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
        const options = { keyboard: this.keyboard(link.id) }
        try {
            if (post.photoFileId) {
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
    photo: OutgoingFile | null,
): PublishPostUseCase {
    const publisher = new TelegramChannelPublisher(services, business, photo)
    return new PublishPostUseCase({ ...linkDeps(services), publisher })
}

export function deleteSourceLinkUseCase(
    services: Services,
    business: Business,
): DeleteSourceLinkUseCase {
    const publisher = new TelegramChannelPublisher(services, business)
    return new DeleteSourceLinkUseCase({ ...linkDeps(services), publisher })
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
