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

export interface InlineButton {
    text: string
    callback_data?: string
    url?: string
    web_app?: { url: string }
}

export interface InlineKeyboard {
    inline_keyboard: InlineButton[][]
}

export interface MessageOptions {
    keyboard?: InlineKeyboard
    /** A reply-keyboard button that sends the person's own contact (the courier's phone). */
    askContact?: string
    /** Hides a reply keyboard shown before (after the contact arrived). */
    removeKeyboard?: boolean
}

function replyMarkup(options: MessageOptions): unknown {
    if (options.keyboard) {
        return options.keyboard
    }
    if (options.askContact) {
        return {
            keyboard: [[{ text: options.askContact, request_contact: true }]],
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
    /** A picture by URL (Telegram downloads it) with an HTML caption: the bots' welcome. */
    sendPhoto(
        token: string,
        chatId: number,
        photoUrl: string,
        captionHtml: string,
        options?: MessageOptions,
    ): Promise<void>
    /** A file in the chat: the owner's CSV report or the QR poster. */
    sendDocument(token: string, chatId: number, file: OutgoingFile, caption?: string): Promise<void>
    setWebhook(token: string, url: string, secretToken: string): Promise<void>
    setMenuButton(token: string, text: string, webAppUrl: string): Promise<void>
    /** The bot's command list: Zumda's bots have only `/start` (the app does the rest). */
    setCommands(token: string, commands: readonly BotCommand[]): Promise<void>
    /** The bot's own picture: Zumda sets it on shop bots (the shop's logo or name + the mark). */
    setProfilePhoto(token: string, jpeg: Uint8Array): Promise<void>
    /** The empty-chat description (≤512) and the profile line (≤120). */
    setDescriptions(token: string, texts: BotDescriptions): Promise<void>
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
        })
        return { messageId: message.message_id }
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
            allowed_updates: ["message", "callback_query"],
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

    async sendDocument(
        token: string,
        chatId: number,
        file: OutgoingFile,
        caption?: string,
    ): Promise<void> {
        const form = new FormData()
        form.set("chat_id", String(chatId))
        form.set("document", new Blob([file.bytes], { type: file.contentType }), file.name)
        if (caption) {
            form.set("caption", caption)
            form.set("parse_mode", "HTML")
        }
        await this.send(token, "sendDocument", { body: form })
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
