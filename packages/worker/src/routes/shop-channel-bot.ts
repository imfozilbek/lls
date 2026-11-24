import { postFactsOf } from "@zumda/core"

import { isRecipientProblem } from "../alerts.js"
import { appKeyboard, productAppUrl, shopAppUrl } from "../telegram/app-links.js"
import { recordChannelPostUseCase } from "../telegram/channel-publisher.js"
import { parseSourceStart } from "../telegram/format.js"
import { TelegramApiError, escapeHtml } from "../telegram/gateway.js"
import { Notifier } from "../telegram/notifier.js"
import { productCardCaption } from "../telegram/post-caption.js"
import { fill } from "../telegram/texts.js"

import type { Services } from "../services.js"
import type { InlineKeyboard, OutgoingFile } from "../telegram/gateway.js"
import type { BotTexts } from "../telegram/texts.js"
import type { ChannelPostUpdate, ChatMemberUpdate } from "../telegram/updates.js"
import type { Business, Product, SourceLink } from "@zumda/core"

/** Telegram's word for an admin; the bot may post only with `can_post_messages`. */
const ADMINISTRATOR = "administrator"

function named(title: string): string {
    return `<b>«${escapeHtml(title)}»</b>`
}

/**
 * The shop's bot in a channel (owner's decision, November 2026): made an admin who may post, it
 * connects the owner's channel; added by someone else, or to a demo shop, it leaves at once and
 * the owner hears why; removed or left without the right to post, the channel is disconnected.
 * News about a channel the bot already left (the echo of its own leaving) changes nothing.
 */
export async function handleChannelMembership(
    services: Services,
    business: Business,
    token: string,
    update: ChatMemberUpdate,
    t: BotTexts,
): Promise<void> {
    const { chat, from, new_chat_member: member } = update
    if (chat.type !== "channel" || member.user.id !== business.bot.id) {
        return
    }
    const notifier = new Notifier(services)
    const title = chat.title ?? chat.username ?? String(chat.id)
    if (member.status === ADMINISTRATOR && member.can_post_messages === true) {
        const outcome = await services.useCases.connectShopChannel.execute({
            businessId: business.id,
            actorTelegramId: from.id,
            chatId: chat.id,
            title,
            ...(chat.username === undefined ? {} : { username: chat.username }),
            now: services.clock.now(),
        })
        if (outcome.kind === "refused") {
            await services.telegram.leaveChat(token, chat.id)
            const news = outcome.why === "demo" ? t.channelDemo : t.channelNotByOwner
            await notifier.channelNews(business, fill(news, { channel: named(title) }))
        } else if (outcome.kind === "connected") {
            if (outcome.replaced) {
                await services.telegram.leaveChat(token, outcome.replaced.chatId)
            }
            await notifier.channelNews(
                business,
                fill(t.channelConnected, { channel: named(title) }),
            )
        }
        return
    }
    const lost = await services.useCases.loseShopChannel.execute({
        businessId: business.id,
        chatId: chat.id,
    })
    if (lost) {
        await notifier.channelNews(business, fill(t.channelLost, { channel: named(lost.title) }))
    }
}

const MS_PER_SECOND = 1000

/** Buttons under a post already: Zumda's own post, or another bot's (they stay as they are). */
function hasButtons(markup: unknown): boolean {
    if (typeof markup !== "object" || markup === null || !("inline_keyboard" in markup)) {
        return false
    }
    const rows = (markup as { inline_keyboard: unknown }).inline_keyboard
    return Array.isArray(rows) && rows.length > 0
}

/**
 * A post in a channel the shop's bot is an admin of (owner's decision, November 2026: every post
 * of the shop's channel is in Zumda, with «Buyurtma berish» at once). Each photo of an album
 * comes on its own: the one with the words stands for the album.
 */
export async function handleChannelPost(
    services: Services,
    business: Business,
    post: ChannelPostUpdate,
): Promise<void> {
    if (post.chat.type !== "channel" || hasButtons(post.reply_markup)) {
        return
    }
    const text = post.text ?? post.caption
    await recordChannelPostUseCase(services, business).execute({
        businessId: business.id,
        chatId: post.chat.id,
        messageId: post.message_id,
        ...(text === undefined ? {} : { text }),
        album: post.media_group_id !== undefined,
        date: new Date(post.date * MS_PER_SECOND),
        now: services.clock.now(),
    })
}

/** The product's own photo from R2, for a link to it that has no post (an ad link). */
async function productPhoto(services: Services, product: Product): Promise<OutgoingFile | null> {
    const key = product.imageKey
    const object = key ? await services.env.BUCKET.get(key) : null
    if (!object || !key) {
        return null
    }
    return {
        name: key.split("/").at(-1) ?? "photo",
        contentType: object.httpMetadata?.contentType ?? "image/jpeg",
        bytes: new Uint8Array(await object.arrayBuffer()),
    }
}

/**
 * The product's card: the post's own photo by Telegram's id, or the catalog's photo; Telegram
 * refusing a picture leaves the text (someone who never pressed Start is no failure of ours).
 */
/**
 * A product's card in the bot: the post's photo by its Telegram id when a post was pressed, else
 * the catalog's photo, else text.
 */
export async function sendProductCard(
    services: Services,
    card: { token: string; chatId: number; link?: SourceLink; product: Product },
    caption: string,
    keyboard: InlineKeyboard,
): Promise<void> {
    const { token, chatId, link, product } = card
    const telegram = services.telegram
    try {
        const fileId = link?.post?.photoFileId
        if (fileId) {
            await telegram.sendPhoto(token, chatId, fileId, caption, { keyboard })
            return
        }
        const photo = await productPhoto(services, product)
        if (photo) {
            await telegram.sendPhotoFile(token, chatId, photo, caption, { keyboard })
            return
        }
    } catch (error) {
        if (!(error instanceof TelegramApiError) || isRecipientProblem(error)) {
            throw error
        }
    }
    await telegram.sendMessage(token, chatId, caption, { keyboard })
}

/**
 * `/start s_<code>`: a post's button or an ad link was pressed. The visit is kept for the
 * person's next order (never the owner's). A link to a product answers with its card and a button
 * that opens the storefront on it; a link to the whole shop, or an unknown one, leaves the usual
 * greeting (returns false).
 */
export async function handleSourceStart(
    services: Services,
    business: Business,
    message: { token: string; chatId: number; fromId: number; text?: string },
    t: BotTexts,
): Promise<boolean> {
    const code = parseSourceStart(message.text)
    const now = services.clock.now()
    const link = code
        ? await services.useCases.openSourceLink.execute({
              businessId: business.id,
              code,
              telegramId: message.fromId,
              now,
          })
        : null
    if (!link?.productId || business.isPending()) {
        return false
    }
    if (business.isOwnedBy(message.fromId) && business.ownerChatOpened(now)) {
        await services.businesses.saveOwnerChat(business)
    }
    const { token, chatId } = message
    const origin = services.env.APP_ORIGIN
    const product = await services.products.findById(link.productId)
    if (!product?.belongsTo(business.id)) {
        await services.telegram.sendMessage(token, chatId, t.productGone, {
            keyboard: appKeyboard(t.openMenu, shopAppUrl(origin, business.slug.value)),
        })
        return true
    }
    const soldOut = product.soldOut || !product.isAvailableAt(now)
    const caption = productCardCaption(postFactsOf(product), soldOut, t)
    const keyboard = appKeyboard(
        t.seeProduct,
        productAppUrl(origin, business.slug.value, product.id),
    )
    await sendProductCard(services, { token, chatId, link, product }, caption, keyboard)
    return true
}
