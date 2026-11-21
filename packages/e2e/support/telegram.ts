/**
 * The Telegram side of a test: what the bots sent (read from the fake Bot API) and the updates
 * a person makes in a chat (sent to the Worker's webhooks the way Telegram does).
 */
import { expect } from "@playwright/test"

import {
    FAKE_TELEGRAM_URL,
    WORKER_URL,
    adminBot,
    businessBot,
    courierBot,
    newBotUsername,
    platformBot,
    shopBySlug,
} from "../stand/config.js"

import { fetchOnce } from "./fetch-once.js"

import type { BotCall } from "../stand/fake-telegram.js"

export type { BotCall }

export interface TgUser {
    id: number
    first_name: string
    last_name?: string
    language_code?: string
}

export interface Button {
    text: string
    callback_data?: string
    url?: string
    web_app?: { url: string }
    /** One tap copies this text (the card number, the courier's address). */
    copy_text?: { text: string }
    style?: "success" | "danger" | "primary"
}

/** A message a bot sent or edited. */
export interface BotMessage {
    seq: number
    token: string
    method: string
    chatId: number
    text: string
    /** The picture URL of a sendPhoto (a welcome); the text is then its caption. */
    photo?: string
    /** The video URL of a sendVideo (a welcome with its instruction); the text is its caption. */
    video?: string
    buttons: Button[]
    /** The buttons of a reply keyboard under the input (the contact button and its neighbor). */
    replyButtons: ReplyButton[]
}

export interface ReplyButton {
    text: string
    request_contact?: boolean
}

export async function botCalls(): Promise<BotCall[]> {
    const response = await fetchOnce(`${FAKE_TELEGRAM_URL}/__log`)
    return (await response.json()) as BotCall[]
}

export async function resetTelegram(): Promise<void> {
    await fetchOnce(`${FAKE_TELEGRAM_URL}/__reset`, { method: "POST" })
}

export async function controlTelegram(control: {
    broken?: number[]
    blocked?: number[]
    /** `<bot username>:<chat id>`: never pressed Start in that bot; it may not write first. */
    notStarted?: string[]
    failWebhooks?: boolean
    /** The owner presses «Revoke token» in @BotFather for this managed bot. */
    revokeManagedBot?: number
    /** Public channels' past, by username: what `t.me/s/<username>` shows. */
    channelPages?: Record<string, { id: number; text?: string; album?: boolean }[]>
    /** The next button under a channel's post: Telegram asks to wait this many seconds. */
    buttonsRetryAfter?: number
}): Promise<void> {
    await fetchOnce(`${FAKE_TELEGRAM_URL}/__control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(control),
    })
}

function toMessage(call: BotCall): BotMessage {
    // Multipart calls (a photo file) carry the keyboard as a JSON string.
    const raw = call.body["reply_markup"]
    const markup = (typeof raw === "string" ? JSON.parse(raw) : raw) as
        { inline_keyboard?: Button[][]; keyboard?: ReplyButton[][] } | undefined
    return {
        seq: call.seq,
        token: call.token,
        method: call.method,
        chatId: Number(call.body["chat_id"]),
        text: String(call.body["text"] ?? call.body["caption"] ?? ""),
        photo: typeof call.body["photo"] === "string" ? call.body["photo"] : undefined,
        video: typeof call.body["video"] === "string" ? call.body["video"] : undefined,
        buttons: markup?.inline_keyboard?.flat() ?? [],
        replyButtons: markup?.keyboard?.flat() ?? [],
    }
}

const MESSAGE_METHODS = [
    "sendMessage",
    "sendPhoto",
    "sendVideo",
    "editMessageText",
    "editMessageCaption",
]

/** Messages (sent, sent with a picture, and edited) to one chat, oldest first. */
export async function messagesTo(chatId: number, since = 0): Promise<BotMessage[]> {
    return (await botCalls())
        .filter((c) => c.seq > since && MESSAGE_METHODS.includes(c.method))
        .map(toMessage)
        .filter((m) => m.chatId === chatId)
}

export async function lastSeq(): Promise<number> {
    return (await botCalls()).at(-1)?.seq ?? 0
}

/** Waits until a bot writes `chatId` a message that contains `text`; returns it. */
export async function waitForMessage(
    chatId: number,
    text: string | RegExp,
    since = 0,
): Promise<BotMessage> {
    let found: BotMessage | undefined
    await expect
        .poll(
            async () => {
                const messages = await messagesTo(chatId, since)
                found = messages.findLast((m) =>
                    typeof text === "string" ? m.text.includes(text) : text.test(m.text),
                )
                return found !== undefined
            },
            { message: `message to ${chatId} with ${String(text)}`, timeout: 10_000 },
        )
        .toBe(true)
    if (!found) {
        throw new Error("unreachable")
    }
    return found
}

/** Waits for a Bot API call of `method` made with `token` after `since`; returns it. */
export async function waitForCall(method: string, token: string, since = 0): Promise<BotCall> {
    let found: BotCall | undefined
    await expect
        .poll(
            async () => {
                found = (await callsOf(method, since)).findLast((c) => c.token === token)
                return found !== undefined
            },
            { message: `${method} by ${token.split(":")[0] ?? ""}`, timeout: 10_000 },
        )
        .toBe(true)
    if (!found) {
        throw new Error("unreachable")
    }
    return found
}

/** Bot API calls of one method after `since` (setWebhook, setChatMenuButton, …). */
export async function callsOf(method: string, since = 0): Promise<BotCall[]> {
    return (await botCalls()).filter((c) => c.method === method && c.seq > since)
}

let updateId = 1

async function postUpdate(path: string, secret: string, update: object): Promise<Response> {
    return fetchOnce(`${WORKER_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Telegram-Bot-Api-Secret-Token": secret,
        },
        body: JSON.stringify({ update_id: updateId++, ...update }),
    })
}

/** A chat with one bot: the shop's own bot, the Zumda bot or the Zumda courier bot. */
export interface Chat {
    send(from: TgUser, text: string): Promise<Response>
    shareContact(from: TgUser, phone: string, userId?: number): Promise<Response>
    /** A button under a message; with `messageId` the bot may edit that message in place. */
    press(from: TgUser, data: string, messageId?: number): Promise<Response>
}

function chat(path: string, secret: string): Chat {
    const message = (from: TgUser, extra: object): object => ({
        message: {
            message_id: updateId,
            date: Math.floor(Date.now() / 1000),
            chat: { id: from.id, type: "private" },
            from: { ...from, is_bot: false },
            ...extra,
        },
    })
    return {
        send: (from, text) => postUpdate(path, secret, message(from, { text })),
        shareContact: (from, phone, userId = from.id) =>
            postUpdate(
                path,
                secret,
                message(from, {
                    contact: { phone_number: phone, first_name: from.first_name, user_id: userId },
                }),
            ),
        press: (from, data, messageId) =>
            postUpdate(path, secret, {
                callback_query: {
                    id: `cb-${updateId}`,
                    from: { ...from, is_bot: false },
                    chat_instance: "1",
                    data,
                    ...(messageId === undefined
                        ? {}
                        : {
                              message: {
                                  message_id: messageId,
                                  date: Math.floor(Date.now() / 1000),
                                  chat: { id: from.id, type: "private" },
                              },
                          }),
                },
            }),
    }
}

/** A Telegram channel the shop's bot may be made an admin of. */
export interface TgChannel {
    id: number
    title: string
    username?: string
}

/**
 * Telegram tells the shop's bot that `from` changed its place in `channel`: made it an admin who
 * may post («administrator»), or took that away («left», «member»).
 */
export function channelMembership(
    slug: string,
    from: TgUser,
    channel: TgChannel,
    status: "administrator" | "left" | "member",
): Promise<Response> {
    const shop = shopBySlug(slug)
    return postUpdate(`/tg/${shop.bot.id}`, shop.bot.webhookSecret, {
        my_chat_member: {
            chat: { ...channel, type: "channel" },
            from: { ...from, is_bot: false },
            date: Math.floor(Date.now() / 1000),
            old_chat_member: { status: "left", user: { id: shop.bot.id, is_bot: true } },
            new_chat_member: {
                status,
                user: { id: shop.bot.id, is_bot: true },
                ...(status === "administrator"
                    ? {
                          can_post_messages: true,
                          can_edit_messages: true,
                          can_delete_messages: true,
                      }
                    : {}),
            },
        },
    })
}

/**
 * A post the owner made in the channel, as Telegram brings it to the shop's bot (an album: each
 * photo on its own, the words with one of them).
 */
export function channelPost(
    slug: string,
    channel: TgChannel,
    post: { messageId: number; text?: string; caption?: string; albumId?: string; chatId?: number },
): Promise<Response> {
    const shop = shopBySlug(slug)
    return postUpdate(`/tg/${shop.bot.id}`, shop.bot.webhookSecret, {
        channel_post: {
            message_id: post.messageId,
            date: Math.floor(Date.now() / 1000),
            chat: { ...channel, id: post.chatId ?? channel.id, type: "channel" },
            sender_chat: { ...channel, type: "channel" },
            ...(post.text === undefined ? {} : { text: post.text }),
            ...(post.caption === undefined ? {} : { caption: post.caption, photo: [] }),
            ...(post.albumId === undefined ? {} : { media_group_id: post.albumId }),
        },
    })
}

export function shopChat(slug: string): Chat {
    const shop = shopBySlug(slug)
    return chat(`/tg/${shop.bot.id}`, shop.bot.webhookSecret)
}

export function platformChat(): Chat {
    return chat("/tg/platform", platformBot().secret)
}

/** The Zumda Business bot: owners, applications, the old approval cards. */
export function businessChat(): Chat {
    return chat("/tg/business", businessBot().secret)
}

/** Zumda | Platforma: the admins' bot, its approval cards and their buttons. */
export function adminChat(): Chat {
    return chat("/tg/admin", adminBot().secret)
}

/** The Zumda courier bot: invites, the phone, order cards and their buttons. */
export function courierChat(): Chat {
    return chat("/tg/courier", courierBot().secret)
}

/** A chat with a freshly approved shop bot: its secret lives only in D1. */
export function chatWithSecret(botId: number, secret: string): Chat {
    return chat(`/tg/${botId}`, secret)
}

/**
 * Telegram tells Zumda Business that `owner` created the bot `botId` in the «create a bot» window
 * (or that its token changed, or someone else owns it now).
 */
export function managedBotUpdate(owner: TgUser, botId: number): Promise<Response> {
    return postUpdate("/tg/business", businessBot().secret, {
        managed_bot: {
            user: { ...owner, is_bot: false },
            bot: {
                id: botId,
                is_bot: true,
                first_name: "New shop",
                username: newBotUsername(botId),
            },
        },
    })
}
