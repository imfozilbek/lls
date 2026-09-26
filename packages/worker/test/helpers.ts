import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { env } from "cloudflare:workers"

import { createApp } from "../src/app.js"
import { TelegramApiError } from "../src/telegram/gateway.js"

import type { BotInfo, MessageOptions, TelegramGateway } from "../src/telegram/gateway.js"
import type { Clock } from "@lls/core"

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
    async answerCallback(_token: string, callbackQueryId: string): Promise<void> {
        this.answered.push(callbackQueryId)
    }
    async setWebhook(token: string, url: string, secret: string): Promise<void> {
        this.webhooks.push({ token, url, secret })
    }
    async setMenuButton(token: string, _text: string, url: string): Promise<void> {
        this.menuButtons.push({ token, url })
    }
}

export interface TestClient {
    telegram: FakeTelegram
    request(path: string, init?: RequestInit): Promise<Response>
    /** Request as `user` inside the Mini App opened from `botToken` (X-Shop = slug). */
    as(
        user: object,
        options: { botToken?: string; shop?: string },
    ): (path: string, init?: RequestInit & { json?: unknown }) => Promise<Response>
}

export function testClient(
    options: { bots?: Record<string, BotInfo>; clock?: Clock } = {},
): TestClient {
    const telegram = new FakeTelegram(options.bots)
    const app = createApp({ telegram, clock: options.clock })

    async function request(path: string, init: RequestInit = {}): Promise<Response> {
        const ctx = createExecutionContext()
        const response = await app.request(path, init, env, ctx)
        await waitOnExecutionContext(ctx)
        return response
    }

    return {
        telegram,
        request,
        as(user, { botToken = env.PLATFORM_BOT_TOKEN, shop }) {
            return async (path, init = {}) => {
                const headers = new Headers(init.headers)
                headers.set("X-Telegram-Init-Data", await signInitData(user, botToken))
                if (shop) {
                    headers.set("X-Shop", shop)
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

/** Registers a shop through the real onboarding API and approves it as admin. */
export async function createActiveShop(client: TestClient): Promise<{ id: string; slug: string }> {
    const owner = client.as(OWNER, {})
    const response = await owner("/api/platform/shops", {
        method: "POST",
        json: {
            botToken: SHOP_BOT_TOKEN,
            name: "Osh Markaz",
            type: "food",
            address: "Chorsu",
            deliveryFee: 10_000,
            freeDeliveryFrom: 200_000,
        },
    })
    if (response.status !== 201) {
        throw new Error(`Shop registration failed: ${await response.text()}`)
    }
    const shop = (await response.json()) as { id: string; slug: string }
    await env.DB.prepare("UPDATE businesses SET status = 'active' WHERE id = ?").bind(shop.id).run()
    return shop
}

export const SHOP_BOT: BotInfo = { id: 777000, username: "osh_markaz_bot", firstName: "Osh" }
