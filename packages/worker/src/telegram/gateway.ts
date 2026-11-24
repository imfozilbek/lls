export const TELEGRAM_API_BASE = "https://api.telegram.org"
/** Hosts a local stand may point the Bot API at; anything else falls back to Telegram. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"])

/**
 * The Bot API address. A local stand sets `TELEGRAM_API_BASE` to a fake Telegram on localhost;
 * any other value is ignored, so a mistaken or hostile setting can never send bot tokens away.
 */
export function telegramApiBase(configured: string | undefined): string {
    if (!configured) {
        return TELEGRAM_API_BASE
    }
    try {
        const url = new URL(configured)
        const local = url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)
        return local ? url.origin : TELEGRAM_API_BASE
    } catch {
        return TELEGRAM_API_BASE
    }
}

/**
 * A button's colour (Bot API 9.4): the step to make is green, a refusal is red, the customer's
 * one thing to do is blue. An older Telegram shows a plain button.
 */
export type ButtonStyle = "success" | "danger" | "primary"

export interface InlineButton {
    text: string
    callback_data?: string
    url?: string
    web_app?: { url: string }
    /** One tap copies this text (Bot API 7.11): a card number, an address, a link. */
    copy_text?: { text: string }
    style?: ButtonStyle
}

export interface InlineKeyboard {
    inline_keyboard: InlineButton[][]
}

export interface MessageOptions {
    keyboard?: InlineKeyboard
    /** A reply-keyboard button that sends the person's own contact (the courier's phone). */
    askContact?: string
    /** A second reply button under it that answers with its own text («Boshqa raqam yozaman»). */
    askContactOr?: string
    /** Hides a reply keyboard shown before (after the contact arrived). */
    removeKeyboard?: boolean
    /** Answers this earlier message of the chat (its card): the quote carries the context. */
    replyTo?: number
    /** Arrives without a sound: nothing to do about it now. */
    silent?: boolean
    /** A photo's caption over the picture: the sum is read first. */
    captionAbove?: boolean
    /** A topic of a group with topics: a customer's own topic in the shop's support group. */
    threadId?: number
}

/** What every send takes besides its text: the message answered, the silence. */
function sendExtras(options: MessageOptions): Record<string, unknown> {
    return {
        ...(options.replyTo === undefined
            ? {}
            : {
                  reply_parameters: {
                      message_id: options.replyTo,
                      // The card may be gone (deleted by the person): the message still goes.
                      allow_sending_without_reply: true,
                  },
              }),
        ...(options.silent ? { disable_notification: true } : {}),
        ...(options.threadId === undefined ? {} : { message_thread_id: options.threadId }),
    }
}

function replyMarkup(options: MessageOptions): unknown {
    if (options.keyboard) {
        return options.keyboard
    }
    if (options.askContact) {
        return {
            keyboard: [
                [{ text: options.askContact, request_contact: true }],
                ...(options.askContactOr ? [[{ text: options.askContactOr }]] : []),
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        }
    }
    return options.removeKeyboard ? { remove_keyboard: true } : undefined
}

/** A button that asks the user to create a bot managed by ours (Telegram Managed Bots). */
export interface ManagedBotButton {
    text: string
    requestId: number
    suggestedName?: string
    suggestedUsername?: string
}

export interface BotInfo {
    id: number
    username: string
    firstName: string
}

export interface OutgoingFile {
    name: string
    contentType: string
    bytes: Uint8Array
}

/** Telegram takes a bot's upload up to this size (sendVideo by multipart). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

/**
 * A video on its way from the owner's phone to the channel: its bytes pass through as a stream,
 * never held whole in the Worker's memory.
 */
export interface OutgoingVideo {
    name: string
    contentType: string
    size: number
    body: ReadableStream<Uint8Array>
}

/** A picture sent: its message, and Telegram's id of the photo to send again without bytes. */
export interface SentPhoto {
    messageId: number
    photoFileId?: string
}

/** `refused`: Telegram did not delete it (it stays where it is). */
export type ChannelPostRemoval = "removed" | "refused"

/** A video Telegram downloads by URL; its cover and size lay it out in the chat at once. */
export interface VideoLink {
    url: string
    coverUrl: string
    width: number
    height: number
    durationS: number
}

/** Everything the Worker needs from the Bot API. Faked in tests. */
export interface TelegramGateway {
    getMe(token: string): Promise<BotInfo>
    sendMessage(
        token: string,
        chatId: number,
        html: string,
        options?: MessageOptions,
    ): Promise<{ messageId: number }>
    editMessage(
        token: string,
        chatId: number,
        messageId: number,
        html: string,
        options?: MessageOptions,
    ): Promise<void>
    /**
     * Removes the bot's own earlier message (the customer's live message is replaced). Gone
     * already, or older than Telegram allows (48 hours): nothing happens.
     */
    deleteMessage(token: string, chatId: number, messageId: number): Promise<void>
    /**
     * Takes the buttons off a message that stays (the screenshot once its question is answered).
     * Gone already, or without buttons: nothing happens.
     */
    clearButtons(token: string, chatId: number, messageId: number): Promise<void>
    /**
     * Puts these buttons under a message: «Buyurtma berish» under the owner's own post in the
     * channel (a bot that may edit the channel's messages). Telegram's refusal is thrown.
     */
    setButtons(
        token: string,
        chatId: number,
        messageId: number,
        keyboard: InlineKeyboard,
    ): Promise<void>
    answerCallback(token: string, callbackQueryId: string, text?: string): Promise<void>
    /**
     * Managed Bots: a button the user presses inside the Mini App (`WebApp.requestChat(id)`) to
     * create a bot managed by `token`'s bot. Returns the prepared button's id.
     */
    savePreparedKeyboardButton(
        token: string,
        userId: number,
        button: ManagedBotButton,
    ): Promise<string>
    /** The token of a bot managed by `token`'s bot. Never logged, never sent to a client. */
    getManagedBotToken(token: string, botId: number): Promise<string>
    /** Revokes the managed bot's token and returns a new one. */
    replaceManagedBotToken(token: string, botId: number): Promise<string>
    /**
     * A picture by URL (Telegram downloads it) or by Telegram's own photo id, with an HTML
     * caption: the bots' welcome, a product's card.
     */
    sendPhoto(
        token: string,
        chatId: number,
        photoUrl: string,
        captionHtml: string,
        options?: MessageOptions,
    ): Promise<void>
    /** A video by URL with an HTML caption: the bots' welcome, an instruction of its role. */
    sendVideo(
        token: string,
        chatId: number,
        video: VideoLink,
        captionHtml: string,
        options?: MessageOptions,
    ): Promise<void>
    /**
     * A picture from bytes with an HTML caption and buttons: a transfer receipt for the owner, a
     * product's post in the shop's channel.
     */
    sendPhotoFile(
        token: string,
        chatId: number,
        file: OutgoingFile,
        captionHtml: string,
        options?: MessageOptions,
    ): Promise<SentPhoto>
    /** A video from the owner's phone with an HTML caption and buttons: a channel post. */
    sendVideoFile(
        token: string,
        chatId: number,
        video: OutgoingVideo,
        captionHtml: string,
        options?: MessageOptions,
    ): Promise<{ messageId: number }>
    /** A post's caption written again, with its buttons (an edit without them drops them). */
    editCaption(
        token: string,
        chatId: number,
        messageId: number,
        captionHtml: string,
        options?: MessageOptions,
    ): Promise<void>
    /** Deletes a post of the bot's in a channel: gone already counts as removed. */
    deleteChannelPost(token: string, chatId: number, messageId: number): Promise<ChannelPostRemoval>
    /** The bot leaves a chat; not being there any more is fine. */
    leaveChat(token: string, chatId: number): Promise<void>
    /**
     * A message copied from one chat to another as the bot's own (no «Forwarded from»): a
     * customer's message into their topic, the shop's answer back to the customer. A message
     * Telegram cannot copy (a service message, a poll's quiz) is refused with an error.
     */
    copyMessage(
        token: string,
        fromChatId: number,
        messageId: number,
        toChatId: number,
        options?: MessageOptions,
    ): Promise<{ messageId: number }>
    /** A new topic in a group with topics, with a custom emoji icon when given: its id. */
    createForumTopic(
        token: string,
        chatId: number,
        name: string,
        iconCustomEmojiId?: string,
    ): Promise<{ threadId: number }>
    /** A topic's new name or icon; the same again is fine. */
    editForumTopic(
        token: string,
        chatId: number,
        threadId: number,
        change: TopicChange,
    ): Promise<void>
    /** A topic closed by people opens again; one open already is fine. */
    reopenForumTopic(token: string, chatId: number, threadId: number): Promise<void>
    /** The custom emoji any topic may have as its icon (Telegram's own set). */
    getForumTopicIcons(token: string): Promise<TopicIcon[]>
    /** Pins a message (a topic's card) without a sound; pinned already is fine. */
    pinMessage(token: string, chatId: number, messageId: number): Promise<void>
    /** Deletes a topic and its messages; gone already is fine. */
    deleteForumTopic(token: string, chatId: number, threadId: number): Promise<void>
    /** People in a chat: a channel's subscribers. */
    getChatMemberCount(token: string, chatId: number): Promise<number>
    /** A file in the chat: the owner's CSV report or the QR poster. */
    sendDocument(
        token: string,
        chatId: number,
        file: OutgoingFile,
        caption?: string,
        options?: MessageOptions,
    ): Promise<void>
    /**
     * "typing…" for a few seconds, nothing in the chat: whether the bot may write to this person
     * at all (Telegram answers Forbidden to someone who never pressed Start).
     */
    sendTyping(token: string, chatId: number): Promise<void>
    setWebhook(token: string, url: string, secretToken: string): Promise<void>
    setMenuButton(token: string, text: string, webAppUrl: string): Promise<void>
    /** The bot's command list: Zumda's bots have only `/start` (the app does the rest). */
    setCommands(token: string, commands: readonly BotCommand[]): Promise<void>
    /** The bot's own picture: Zumda sets it on shop bots (the shop's logo or name + the mark). */
    setProfilePhoto(token: string, jpeg: Uint8Array): Promise<void>
    /** The empty-chat description (≤512) and the profile line (≤120). */
    setDescriptions(token: string, texts: BotDescriptions): Promise<void>
}

export interface TopicChange {
    name?: string
    iconCustomEmojiId?: string
}

/** One icon of Telegram's set for topics: the emoji it shows, and its id to set it. */
export interface TopicIcon {
    emoji: string
    customEmojiId: string
}

export interface BotCommand {
    command: string
    description: string
}

export interface BotDescriptions {
    description: string
    shortDescription: string
}

export class TelegramApiError extends Error {
    constructor(
        public readonly method: string,
        public readonly description: string,
    ) {
        super(`Telegram ${method} failed: ${description}`)
        this.name = "TelegramApiError"
    }
}

interface ApiResponse<T> {
    ok: boolean
    result?: T
    description?: string
    parameters?: { retry_after?: number }
}

/** Telegram's «Too Many Requests» this short is waited out once; a longer one fails at once. */
export const RETRY_AFTER_MAX_SECONDS = 5
const MS_PER_SECOND = 1000
const TOO_MANY_REQUESTS = 429

async function readApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
        return (await response.json()) as ApiResponse<T>
    } catch {
        // A Telegram outage answers with an HTML page: still a Telegram failure, not ours.
        return { ok: false, description: `HTTP ${response.status}, not a Bot API answer` }
    }
}

/** Telegram's answers when a message cannot be deleted: already gone, or too old. */
const CANNOT_DELETE = /message to delete not found|message can't be deleted/i

/** Telegram's answers when there are no buttons to take off: gone, or already plain. */
const NOTHING_TO_CLEAR = /message to edit not found|message is not modified/i

/** A post already deleted by someone: removed all the same. */
const ALREADY_DELETED = /message to delete not found/i

/** The topic, or the pin, is as asked already. */
const NOT_MODIFIED = /TOPIC_NOT_MODIFIED|not modified|CHAT_NOT_MODIFIED/i

/** A topic deleted in Telegram (with its messages): nothing more to delete, or to write in. */
export const TOPIC_GONE = /message thread not found|TOPIC_ID_INVALID|topic_deleted|TOPIC_DELETED/i

/** The bot is not in the chat any more: leaving changes nothing. */
const NOT_A_MEMBER = /not a member|chat not found|kicked|Forbidden/i

/**
 * The updates a shop's bot gets: its chats, the buttons, being made a channel's admin, and the
 * channel's posts (each one gets «Buyurtma berish»).
 */
export const SHOP_BOT_UPDATES = ["message", "callback_query", "my_chat_member", "channel_post"]

/**
 * Grows with `SHOP_BOT_UPDATES`: a connected channel whose bot was registered with an older list
 * is registered again (`shop_channels.updates_version`) when its owner opens «Telegram kanal».
 */
export const SHOP_BOT_UPDATES_VERSION = 1

const MULTIPART_LINE = "\r\n"

/** A file's name as a multipart header may carry it: no quotes, no line breaks. */
function headerSafe(name: string): string {
    return name.replace(/["\r\n\\]/g, "_") || "video"
}

/**
 * A multipart body of text fields and one file that streams through: its length is known, so
 * Telegram gets a plain upload and the Worker never holds the file.
 */
export function streamedUpload(
    fields: Record<string, string>,
    fileField: string,
    file: OutgoingVideo,
): { contentType: string; body: ReadableStream<Uint8Array>; done: Promise<void> } {
    const boundary = `zumda${crypto.randomUUID().replace(/-/g, "")}`
    const encoder = new TextEncoder()
    const parts = Object.entries(fields).map(
        ([name, value]) =>
            `--${boundary}${MULTIPART_LINE}Content-Disposition: form-data; name="${name}"` +
            `${MULTIPART_LINE}${MULTIPART_LINE}${value}${MULTIPART_LINE}`,
    )
    const head = encoder.encode(
        `${parts.join("")}--${boundary}${MULTIPART_LINE}Content-Disposition: form-data; ` +
            `name="${fileField}"; filename="${headerSafe(file.name)}"${MULTIPART_LINE}` +
            `Content-Type: ${file.contentType}${MULTIPART_LINE}${MULTIPART_LINE}`,
    )
    const tail = encoder.encode(`${MULTIPART_LINE}--${boundary}--${MULTIPART_LINE}`)
    const { readable, writable } = new FixedLengthStream(
        head.byteLength + file.size + tail.byteLength,
    )
    const done = (async (): Promise<void> => {
        const start = writable.getWriter()
        await start.write(head)
        start.releaseLock()
        await file.body.pipeTo(writable, { preventClose: true })
        const end = writable.getWriter()
        await end.write(tail)
        await end.close()
    })()
    // A broken upload fails the request itself; this only keeps the rejection handled.
    done.catch(() => undefined)
    return {
        contentType: `multipart/form-data; boundary=${boundary}`,
        body: readable,
        done: done.catch(() => undefined),
    }
}

/** Escapes text for Telegram HTML parse mode. */
export function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export class HttpTelegramGateway implements TelegramGateway {
    /** The default calls the global `fetch` unbound: workerd throws "Illegal invocation" otherwise. */
    constructor(
        private readonly fetcher: typeof fetch = (input, init): Promise<Response> =>
            fetch(input, init),
        private readonly apiBase: string = TELEGRAM_API_BASE,
    ) {}

    async getMe(token: string): Promise<BotInfo> {
        const me = await this.call<{ id: number; username?: string; first_name: string }>(
            token,
            "getMe",
            {},
        )
        return { id: me.id, username: me.username ?? "", firstName: me.first_name }
    }

    async sendMessage(
        token: string,
        chatId: number,
        html: string,
        options: MessageOptions = {},
    ): Promise<{ messageId: number }> {
        const message = await this.call<{ message_id: number }>(token, "sendMessage", {
            chat_id: chatId,
            text: html,
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
            reply_markup: replyMarkup(options),
            ...sendExtras(options),
        })
        return { messageId: message.message_id }
    }

    async clearButtons(token: string, chatId: number, messageId: number): Promise<void> {
        try {
            await this.call(token, "editMessageReplyMarkup", {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: [] },
            })
        } catch (error) {
            if (!(error instanceof TelegramApiError) || !NOTHING_TO_CLEAR.test(error.description)) {
                throw error
            }
        }
    }

    async setButtons(
        token: string,
        chatId: number,
        messageId: number,
        keyboard: InlineKeyboard,
    ): Promise<void> {
        await this.call(token, "editMessageReplyMarkup", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
        })
    }

    async deleteMessage(token: string, chatId: number, messageId: number): Promise<void> {
        try {
            await this.call(token, "deleteMessage", { chat_id: chatId, message_id: messageId })
        } catch (error) {
            if (!(error instanceof TelegramApiError) || !CANNOT_DELETE.test(error.description)) {
                throw error
            }
        }
    }

    async editMessage(
        token: string,
        chatId: number,
        messageId: number,
        html: string,
        options: MessageOptions = {},
    ): Promise<void> {
        await this.call(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: html,
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
            reply_markup: options.keyboard ?? { inline_keyboard: [] },
        })
    }

    async sendPhoto(
        token: string,
        chatId: number,
        photoUrl: string,
        captionHtml: string,
        options: MessageOptions = {},
    ): Promise<void> {
        await this.call(token, "sendPhoto", {
            chat_id: chatId,
            photo: photoUrl,
            caption: captionHtml,
            parse_mode: "HTML",
            reply_markup: replyMarkup(options),
        })
    }

    async sendVideo(
        token: string,
        chatId: number,
        video: VideoLink,
        captionHtml: string,
        options: MessageOptions = {},
    ): Promise<void> {
        await this.call(token, "sendVideo", {
            chat_id: chatId,
            video: video.url,
            cover: video.coverUrl,
            width: video.width,
            height: video.height,
            duration: video.durationS,
            supports_streaming: true,
            caption: captionHtml,
            parse_mode: "HTML",
            reply_markup: replyMarkup(options),
        })
    }

    async savePreparedKeyboardButton(
        token: string,
        userId: number,
        button: ManagedBotButton,
    ): Promise<string> {
        const prepared = await this.call<{ id: string }>(token, "savePreparedKeyboardButton", {
            user_id: userId,
            button: {
                text: button.text,
                request_managed_bot: {
                    request_id: button.requestId,
                    suggested_name: button.suggestedName,
                    suggested_username: button.suggestedUsername,
                },
            },
        })
        return prepared.id
    }

    async getManagedBotToken(token: string, botId: number): Promise<string> {
        return this.call<string>(token, "getManagedBotToken", { user_id: botId })
    }

    async replaceManagedBotToken(token: string, botId: number): Promise<string> {
        return this.call<string>(token, "replaceManagedBotToken", { user_id: botId })
    }

    async answerCallback(token: string, callbackQueryId: string, text?: string): Promise<void> {
        await this.call(token, "answerCallbackQuery", { callback_query_id: callbackQueryId, text })
    }

    async setWebhook(token: string, url: string, secretToken: string): Promise<void> {
        await this.call(token, "setWebhook", {
            url,
            secret_token: secretToken,
            allowed_updates: SHOP_BOT_UPDATES,
            // Never drop the queue: a reconnect must not lose a customer's contact or a press.
            drop_pending_updates: false,
        })
    }

    async setMenuButton(token: string, text: string, webAppUrl: string): Promise<void> {
        await this.call(token, "setChatMenuButton", {
            menu_button: { type: "web_app", text, web_app: { url: webAppUrl } },
        })
    }

    async setCommands(token: string, commands: readonly BotCommand[]): Promise<void> {
        await this.call(token, "setMyCommands", { commands })
    }

    async setProfilePhoto(token: string, jpeg: Uint8Array): Promise<void> {
        const form = new FormData()
        form.set("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }))
        form.set("avatar", new Blob([jpeg], { type: "image/jpeg" }), "avatar.jpg")
        await this.send(token, "setMyProfilePhoto", { body: form })
    }

    async setDescriptions(token: string, texts: BotDescriptions): Promise<void> {
        await this.call(token, "setMyDescription", { description: texts.description })
        await this.call(token, "setMyShortDescription", {
            short_description: texts.shortDescription,
        })
    }

    async sendVideoFile(
        token: string,
        chatId: number,
        video: OutgoingVideo,
        captionHtml: string,
        options: MessageOptions = {},
    ): Promise<{ messageId: number }> {
        const fields: Record<string, string> = {
            chat_id: String(chatId),
            caption: captionHtml,
            parse_mode: "HTML",
            supports_streaming: "true",
            ...(options.keyboard ? { reply_markup: JSON.stringify(options.keyboard) } : {}),
        }
        const upload = streamedUpload(fields, "video", video)
        // A stream is read once: Telegram asking to wait is the caller's to answer, not ours.
        const sent = await this.send<{ message_id: number }>(
            token,
            "sendVideo",
            { headers: { "Content-Type": upload.contentType }, body: upload.body },
            true,
        )
        await upload.done
        return { messageId: sent.message_id }
    }

    async sendPhotoFile(
        token: string,
        chatId: number,
        file: OutgoingFile,
        captionHtml: string,
        options?: MessageOptions,
    ): Promise<SentPhoto> {
        const form = new FormData()
        form.set("chat_id", String(chatId))
        form.set("photo", new Blob([file.bytes], { type: file.contentType }), file.name)
        form.set("caption", captionHtml)
        form.set("parse_mode", "HTML")
        if (options?.keyboard) {
            form.set("reply_markup", JSON.stringify(options.keyboard))
        }
        if (options?.captionAbove) {
            form.set("show_caption_above_media", "true")
        }
        for (const [key, value] of Object.entries(sendExtras(options ?? {}))) {
            form.set(key, typeof value === "string" ? value : JSON.stringify(value))
        }
        const sent = await this.send<{ message_id: number; photo?: { file_id: string }[] }>(
            token,
            "sendPhoto",
            { body: form },
        )
        // The sizes come smallest first: the largest is the one to send again.
        const fileId = sent.photo?.at(-1)?.file_id
        return { messageId: sent.message_id, ...(fileId ? { photoFileId: fileId } : {}) }
    }

    async editCaption(
        token: string,
        chatId: number,
        messageId: number,
        captionHtml: string,
        options: MessageOptions = {},
    ): Promise<void> {
        await this.call(token, "editMessageCaption", {
            chat_id: chatId,
            message_id: messageId,
            caption: captionHtml,
            parse_mode: "HTML",
            reply_markup: options.keyboard ?? { inline_keyboard: [] },
        })
    }

    async deleteChannelPost(
        token: string,
        chatId: number,
        messageId: number,
    ): Promise<ChannelPostRemoval> {
        try {
            await this.call(token, "deleteMessage", { chat_id: chatId, message_id: messageId })
            return "removed"
        } catch (error) {
            if (!(error instanceof TelegramApiError) || !CANNOT_DELETE.test(error.description)) {
                throw error
            }
            return ALREADY_DELETED.test(error.description) ? "removed" : "refused"
        }
    }

    async leaveChat(token: string, chatId: number): Promise<void> {
        try {
            await this.call(token, "leaveChat", { chat_id: chatId })
        } catch (error) {
            if (!(error instanceof TelegramApiError) || !NOT_A_MEMBER.test(error.description)) {
                throw error
            }
        }
    }

    async copyMessage(
        token: string,
        fromChatId: number,
        messageId: number,
        toChatId: number,
        options: MessageOptions = {},
    ): Promise<{ messageId: number }> {
        const copied = await this.call<{ message_id: number }>(token, "copyMessage", {
            chat_id: toChatId,
            from_chat_id: fromChatId,
            message_id: messageId,
            ...sendExtras(options),
            ...(options.keyboard ? { reply_markup: options.keyboard } : {}),
        })
        return { messageId: copied.message_id }
    }

    async createForumTopic(
        token: string,
        chatId: number,
        name: string,
        iconCustomEmojiId?: string,
    ): Promise<{ threadId: number }> {
        const topic = await this.call<{ message_thread_id: number }>(token, "createForumTopic", {
            chat_id: chatId,
            name,
            ...(iconCustomEmojiId ? { icon_custom_emoji_id: iconCustomEmojiId } : {}),
        })
        return { threadId: topic.message_thread_id }
    }

    async editForumTopic(
        token: string,
        chatId: number,
        threadId: number,
        change: TopicChange,
    ): Promise<void> {
        await this.unlessUnchanged(() =>
            this.call(token, "editForumTopic", {
                chat_id: chatId,
                message_thread_id: threadId,
                ...(change.name === undefined ? {} : { name: change.name }),
                ...(change.iconCustomEmojiId === undefined
                    ? {}
                    : { icon_custom_emoji_id: change.iconCustomEmojiId }),
            }),
        )
    }

    async reopenForumTopic(token: string, chatId: number, threadId: number): Promise<void> {
        await this.unlessUnchanged(() =>
            this.call(token, "reopenForumTopic", { chat_id: chatId, message_thread_id: threadId }),
        )
    }

    async getForumTopicIcons(token: string): Promise<TopicIcon[]> {
        const stickers = await this.call<{ emoji?: string; custom_emoji_id?: string }[]>(
            token,
            "getForumTopicIconStickers",
            {},
        )
        return stickers.flatMap((sticker) =>
            sticker.emoji && sticker.custom_emoji_id
                ? [{ emoji: sticker.emoji, customEmojiId: sticker.custom_emoji_id }]
                : [],
        )
    }

    async pinMessage(token: string, chatId: number, messageId: number): Promise<void> {
        await this.unlessUnchanged(() =>
            this.call(token, "pinChatMessage", {
                chat_id: chatId,
                message_id: messageId,
                disable_notification: true,
            }),
        )
    }

    /** Telegram says the topic or the pin is as asked already: nothing was wrong. */
    private async unlessUnchanged(work: () => Promise<unknown>): Promise<void> {
        try {
            await work()
        } catch (error) {
            if (!(error instanceof TelegramApiError) || !NOT_MODIFIED.test(error.description)) {
                throw error
            }
        }
    }

    async deleteForumTopic(token: string, chatId: number, threadId: number): Promise<void> {
        try {
            await this.call(token, "deleteForumTopic", {
                chat_id: chatId,
                message_thread_id: threadId,
            })
        } catch (error) {
            if (!(error instanceof TelegramApiError) || !TOPIC_GONE.test(error.description)) {
                throw error
            }
        }
    }

    async getChatMemberCount(token: string, chatId: number): Promise<number> {
        return this.call<number>(token, "getChatMemberCount", { chat_id: chatId })
    }

    async sendDocument(
        token: string,
        chatId: number,
        file: OutgoingFile,
        caption?: string,
        options?: MessageOptions,
    ): Promise<void> {
        const form = new FormData()
        form.set("chat_id", String(chatId))
        form.set("document", new Blob([file.bytes], { type: file.contentType }), file.name)
        if (caption) {
            form.set("caption", caption)
            form.set("parse_mode", "HTML")
        }
        if (options?.keyboard) {
            form.set("reply_markup", JSON.stringify(options.keyboard))
        }
        await this.send(token, "sendDocument", { body: form })
    }

    async sendTyping(token: string, chatId: number): Promise<void> {
        await this.call(token, "sendChatAction", { chat_id: chatId, action: "typing" })
    }

    private async call<T>(token: string, method: string, body: object): Promise<T> {
        return this.send<T>(token, method, {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
    }

    private async send<T>(
        token: string,
        method: string,
        init: RequestInit,
        retried = false,
    ): Promise<T> {
        let response: Response
        try {
            response = await this.fetcher(`${this.apiBase}/bot${token}/${method}`, {
                method: "POST",
                ...init,
            })
        } catch (error) {
            // The message may carry the URL, and with it the token: only the kind of failure.
            const kind = error instanceof Error ? error.name : "unknown"
            throw new TelegramApiError(method, `network error (${kind})`)
        }
        const data = await readApiResponse<T>(response)
        if (data.ok && data.result !== undefined) {
            return data.result
        }
        const wait = data.parameters?.retry_after
        if (
            !retried &&
            response.status === TOO_MANY_REQUESTS &&
            wait !== undefined &&
            wait <= RETRY_AFTER_MAX_SECONDS
        ) {
            await new Promise((resolve) => setTimeout(resolve, wait * MS_PER_SECOND))
            return this.send<T>(token, method, init, true)
        }
        throw new TelegramApiError(method, data.description ?? `HTTP ${response.status}`)
    }
}
