import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { env } from "cloudflare:workers"

import { createApp } from "../src/app.js"
import { TelegramApiError } from "../src/telegram/gateway.js"

import type {
    BotCommand,
    BotDescriptions,
    BotInfo,
    ManagedBotButton,
    MessageOptions,
    OutgoingFile,
    TelegramGateway,
} from "../src/telegram/gateway.js"
import type { Clock } from "@zumda/core"

export const OWNER = { id: 1001, first_name: "Rustam", language_code: "uz" }
export const CUSTOMER = { id: 2002, first_name: "Aziz", last_name: "Karimov", language_code: "ru" }
export const STRANGER = { id: 3003, first_name: "Begona" }
export const ADMIN = { id: 9999, first_name: "Admin" }

export const SHOP_BOT_TOKEN = "777000:shop-bot-token-for-tests-only-xxxxxxxxx"
export const OTHER_BOT_TOKEN = "888000:other-bot-token-for-tests-only-xxxxxxxx"

const encoder = new TextEncoder()

async function hmac(key: Uint8Array | ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    )
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data))
}

/** Builds initData exactly like Telegram does for a Mini App opened from `botToken`. */
export async function signInitData(
    user: object,
    botToken: string,
    authDate: Date = new Date(),
): Promise<string> {
    const params = new URLSearchParams({
        auth_date: String(Math.floor(authDate.getTime() / 1000)),
        query_id: "AAE-test",
        user: JSON.stringify(user),
    })
    const dataCheckString = [...params.entries()]
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join("\n")
    const secret = await hmac(encoder.encode("WebAppData"), botToken)
    const hash = [...new Uint8Array(await hmac(secret, dataCheckString))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    params.set("hash", hash)
    return params.toString()
}

export interface SentMessage {
    token: string
    chatId: number
    html: string
    options?: MessageOptions
}

/** Records Bot API calls instead of hitting Telegram. */
export class FakeTelegram implements TelegramGateway {
    readonly sent: SentMessage[] = []
    readonly edited: (SentMessage & { messageId: number })[] = []
    readonly webhooks: { token: string; url: string; secret: string }[] = []
    readonly menuButtons: { token: string; url: string }[] = []
    readonly answered: string[] = []
    readonly photos: { token: string; jpeg: Uint8Array }[] = []
    readonly descriptions: ({ token: string } & BotDescriptions)[] = []
    readonly pictures: (SentMessage & { photoUrl: string })[] = []
    /** Managed Bots: prepared buttons, and the token Telegram gives for each managed bot. */
    readonly preparedButtons: { token: string; userId: number; button: ManagedBotButton }[] = []
    readonly managedTokens = new Map<number, string>()
    /** Simulates Telegram failing to fetch a picture by URL. */
    failPictures = false
    /** Simulates Telegram refusing a new bot picture. */
    failPhotos = false
    readonly documents: { token: string; chatId: number; file: OutgoingFile; caption?: string }[] =
        []
    /** Simulates a blocked bot or Telegram outage: replies to users fail. */
    failReplies = false
    /** Simulates Telegram refusing setWebhook (network hiccup, revoked token). */
    failWebhooks = false
    /** Simulates a Telegram outage for messages to these chats. */
    readonly brokenChats = new Set<number>()
    private nextMessageId = 100

    constructor(private readonly bots: Record<string, BotInfo> = {}) {}

    async getMe(token: string): Promise<BotInfo> {
        const bot = this.bots[token]
        if (!bot) {
            throw new TelegramApiError("getMe", "Unauthorized")
        }
        return bot
    }
    async sendMessage(
        token: string,
        chatId: number,
        html: string,
        options?: MessageOptions,
    ): Promise<{ messageId: number }> {
        if (this.failReplies) {
            throw new TelegramApiError("sendMessage", "Forbidden: bot was blocked by the user")
        }
        if (this.brokenChats.has(chatId)) {
            throw new TelegramApiError("sendMessage", "Internal Server Error")
        }
        this.sent.push({ token, chatId, html, options })
        return { messageId: this.nextMessageId++ }
    }
    async editMessage(
        token: string,
        chatId: number,
        messageId: number,
        html: string,
        options?: MessageOptions,
    ): Promise<void> {
        this.edited.push({ token, chatId, html, options, messageId })
    }
    async sendPhoto(
        token: string,
        chatId: number,
        photoUrl: string,
        html: string,
        options?: MessageOptions,
    ): Promise<void> {
        if (this.failReplies) {
            throw new TelegramApiError("sendPhoto", "Forbidden: bot was blocked by the user")
        }
        if (this.failPictures) {
            throw new TelegramApiError("sendPhoto", "Bad Request: wrong file identifier/HTTP URL")
        }
        this.pictures.push({ token, chatId, html, options, photoUrl })
    }
    async savePreparedKeyboardButton(
        token: string,
        userId: number,
        button: ManagedBotButton,
    ): Promise<string> {
        this.preparedButtons.push({ token, userId, button })
        return `prepared-${this.preparedButtons.length}`
    }
    async getManagedBotToken(_token: string, botId: number): Promise<string> {
        const token = this.managedTokens.get(botId)
        if (!token) {
            throw new TelegramApiError("getManagedBotToken", "Bad Request: bot is not managed")
        }
        return token
    }
    async replaceManagedBotToken(_token: string, botId: number): Promise<string> {
        const token = `${botId}:replaced-${Date.now()}`
        this.managedTokens.set(botId, token)
        return token
    }
    async answerCallback(_token: string, callbackQueryId: string): Promise<void> {
        if (this.failReplies) {
            throw new TelegramApiError("answerCallbackQuery", "Bad Request: query is too old")
        }
        this.answered.push(callbackQueryId)
    }
    async sendDocument(
        token: string,
        chatId: number,
        file: OutgoingFile,
        caption?: string,
    ): Promise<void> {
        this.documents.push({ token, chatId, file, caption })
    }
    async setWebhook(token: string, url: string, secret: string): Promise<void> {
        if (this.failWebhooks) {
            throw new TelegramApiError("setWebhook", "Bad Gateway")
        }
        this.webhooks.push({ token, url, secret })
    }
    async setMenuButton(token: string, _text: string, url: string): Promise<void> {
        this.menuButtons.push({ token, url })
    }
    readonly commands: { token: string; commands: readonly BotCommand[] }[] = []
    async setCommands(token: string, commands: readonly BotCommand[]): Promise<void> {
        this.commands.push({ token, commands })
    }
    async setProfilePhoto(token: string, jpeg: Uint8Array): Promise<void> {
        if (this.failPhotos) {
            throw new TelegramApiError("setMyProfilePhoto", "Bad Request: PHOTO_INVALID")
        }
        this.photos.push({ token, jpeg })
    }
    async setDescriptions(token: string, texts: BotDescriptions): Promise<void> {
        this.descriptions.push({ token, ...texts })
    }
}

export interface TestClient {
    telegram: FakeTelegram
    request(path: string, init?: RequestInit): Promise<Response>
    /**
     * Request as `user` inside the Mini App opened from `botToken` (X-Shop = slug), or from the
     * Zumda courier bot (`courierBot`).
     */
    as(
        user: object,
        options: {
            botToken?: string
            shop?: string
            via?: "marketplace"
            courierBot?: boolean
            /** Opened from the Zumda Business bot («Mening bizneslarim»). */
            businessBot?: boolean
            authDate?: Date
        },
    ): (path: string, init?: RequestInit & { json?: unknown }) => Promise<Response>
    /** An update from Telegram to the Zumda courier bot's webhook. */
    courierBot(update: object): Promise<Response>
    /** An update from Telegram to the Zumda Business bot's webhook. */
    businessBot(update: object): Promise<Response>
}

export const COURIER_BOT: BotInfo = { id: 100100, username: "zumda_kuryer_bot", firstName: "Zumda" }
export const BUSINESS_BOT: BotInfo = {
    id: 100200,
    username: "zumda_biznes_bot",
    firstName: "Zumda",
}
export const PLATFORM_BOT: BotInfo = { id: 100000, username: "zumdashop_bot", firstName: "Zumda" }

/** The token that signs: a forged one if given, else the bot the app was opened from. */
function signerToken(from: {
    botToken?: string
    courierBot?: boolean
    businessBot?: boolean
}): string {
    if (from.botToken) {
        return from.botToken
    }
    if (from.courierBot) {
        return env.COURIER_BOT_TOKEN
    }
    return from.businessBot ? env.BUSINESS_BOT_TOKEN : env.PLATFORM_BOT_TOKEN
}

export function testClient(
    options: { bots?: Record<string, BotInfo>; clock?: Clock } = {},
): TestClient {
    const telegram = new FakeTelegram({
        [env.COURIER_BOT_TOKEN]: COURIER_BOT,
        [env.PLATFORM_BOT_TOKEN]: PLATFORM_BOT,
        [env.BUSINESS_BOT_TOKEN]: BUSINESS_BOT,
        ...options.bots,
    })
    const app = createApp({ telegram, clock: options.clock })

    async function request(path: string, init: RequestInit = {}): Promise<Response> {
        const ctx = createExecutionContext()
        const response = await app.request(path, init, env, ctx)
        await waitOnExecutionContext(ctx)
        return response
    }

    function webhook(path: string, secret: string, update: object): Promise<Response> {
        return request(path, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-Bot-Api-Secret-Token": secret,
            },
            body: JSON.stringify(update),
        })
    }

    return {
        telegram,
        request,
        courierBot: (update) => webhook("/tg/courier", env.COURIER_WEBHOOK_SECRET, update),
        businessBot: (update) => webhook("/tg/business", env.BUSINESS_WEBHOOK_SECRET, update),
        as(user, { botToken, shop, via, courierBot, businessBot, authDate }) {
            return async (path, init = {}) => {
                const headers = new Headers(init.headers)
                const signer = signerToken({ botToken, courierBot, businessBot })
                headers.set("X-Telegram-Init-Data", await signInitData(user, signer, authDate))
                if (courierBot) {
                    headers.set("X-Bot", "courier")
                } else if (businessBot) {
                    headers.set("X-Bot", "business")
                }
                if (shop) {
                    headers.set("X-Shop", shop)
                }
                if (via) {
                    headers.set("X-Via", via)
                }
                let body = init.body
                if (init.json !== undefined) {
                    headers.set("Content-Type", "application/json")
                    body = JSON.stringify(init.json)
                }
                return request(path, { ...init, headers, body })
            }
        },
    }
}

/**
 * Test shortcut for "the customer sent their phone to every shop's bot": sets the phone and
 * records the share with all shops. Security tests use real contact webhooks instead.
 */
export async function sharePhoneWithShops(telegramId: number): Promise<void> {
    await env.DB.prepare("UPDATE customers SET phone = '+998901234567' WHERE telegram_id = ?")
        .bind(telegramId)
        .run()
    await env.DB.prepare(
        `INSERT OR IGNORE INTO customer_phone_shares (customer_id, business_id, shared_at)
         SELECT c.id, b.id, 0 FROM customers c, businesses b WHERE c.telegram_id = ?`,
    )
        .bind(telegramId)
        .run()
}

/** The shop's card for transfers: a valid Luhn number, not a real card. secret-scan: fake */
export const TEST_CARD = { number: "4111 1111 1111 1111", holder: "Rustam Karimov" }

/** Registers a shop (with its card) through the real onboarding API and approves it as admin. */
export async function createActiveShop(
    client: TestClient,
    shop: { botToken?: string; name?: string; owner?: object } = {},
): Promise<{ id: string; slug: string }> {
    const owner = client.as(shop.owner ?? OWNER, { businessBot: true })
    const response = await owner("/api/platform/shops", {
        method: "POST",
        json: {
            botToken: shop.botToken ?? SHOP_BOT_TOKEN,
            name: shop.name ?? "Osh Markaz",
            type: "food",
            address: "Chorsu",
            deliveryFee: 10_000,
            freeDeliveryFrom: 200_000,
            payoutCard: TEST_CARD,
        },
    })
    if (response.status !== 201) {
        throw new Error(`Shop registration failed: ${await response.text()}`)
    }
    const created = (await response.json()) as { id: string; slug: string }
    await env.DB.prepare("UPDATE businesses SET status = 'active' WHERE id = ?")
        .bind(created.id)
        .run()
    return created
}

/**
 * The whole hiring path: the owner makes an invite, the person accepts it in the Zumda courier bot
 * and shares a phone, the owner approves, the courier starts a shift. Returns the courier id.
 */
export async function hireCourier(
    client: TestClient,
    shop: { slug: string; botToken?: string; owner?: object },
    courier: { id: number; first_name: string; language_code?: string },
): Promise<string> {
    const owner = client.as(shop.owner ?? OWNER, {
        botToken: shop.botToken ?? SHOP_BOT_TOKEN,
        shop: shop.slug,
    })
    const invite = (await (
        await owner("/api/owner/couriers/invites", { method: "POST" })
    ).json()) as { link: string }
    await client.courierBot({
        message: {
            from: courier,
            chat: { id: courier.id },
            text: `/start ${invite.link.split("start=")[1] ?? ""}`,
        },
    })
    await client.courierBot({
        message: {
            from: courier,
            chat: { id: courier.id },
            contact: { phone_number: "+998901112233", user_id: courier.id },
        },
    })
    const list = (await (await owner("/api/owner/couriers")).json()) as {
        id: string
        name: string
    }[]
    const id = list.find((c) => c.name === courier.first_name)?.id ?? ""
    await owner(`/api/owner/couriers/${id}/review`, { method: "POST", json: { approve: true } })
    await client.as(courier, { courierBot: true })("/api/courier/shift", {
        method: "PUT",
        json: { onShift: true },
    })
    return id
}

export const SHOP_BOT: BotInfo = { id: 777000, username: "osh_markaz_bot", firstName: "Osh" }
