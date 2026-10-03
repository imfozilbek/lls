/**
 * A fake Telegram Bot API for the local stand. The Worker sends every bot call here
 * (TELEGRAM_API_BASE); tests read what each bot "sent" and switch on failures.
 *
 *   POST /bot<token>/<method>   the Bot API methods Zumda uses (sendPhoto takes a picture URL);
 *                               Managed Bots: a token stays until it is revoked or replaced
 *   GET  /__log                 every recorded call, oldest first
 *   POST /__reset               forget calls and failures
 *   POST /__control             { broken?: number[], blocked?: number[], failWebhooks?: boolean,
 *                                 revokeManagedBot?: number (the owner's «Revoke token») }
 *
 * Files (sendDocument, setMyProfilePhoto) come as multipart: the call body keeps the text
 * fields, and the file as `{ name, contentType, size, base64 }` under its field name.
 */
import { createServer } from "node:http"

import {
    DEV_SHOPS,
    NEW_BOT_TOKEN_PATTERN,
    businessBot,
    courierBot,
    managedBotToken,
    newBotUsername,
    platformBot,
} from "./config.js"

import type { IncomingMessage, Server, ServerResponse } from "node:http"

export interface BotCall {
    seq: number
    token: string
    method: string
    body: Record<string, unknown>
}

interface Bot {
    id: number
    username: string
    first_name: string
}

interface State {
    calls: BotCall[]
    /** Chats whose messages fail with a Telegram outage (500). */
    broken: Set<number>
    /** Chats that blocked the bot (403). */
    blocked: Set<number>
    failWebhooks: boolean
    nextMessageId: number
    /** How many tokens each managed bot got so far. */
    managedTokens: Map<number, number>
}

function knownBots(): Map<string, Bot> {
    const bots = new Map<string, Bot>()
    for (const shop of DEV_SHOPS) {
        bots.set(shop.bot.token, {
            id: shop.bot.id,
            username: shop.bot.username,
            first_name: shop.name,
        })
    }
    const platform = platformBot()
    const platformId = Number(platform.token.split(":")[0])
    bots.set(platform.token, { id: platformId, username: "zumda_dev_bot", first_name: "Zumda" })
    const business = businessBot()
    bots.set(business.token, {
        id: business.id,
        username: business.username,
        first_name: "Zumda Business",
    })
    const courier = courierBot()
    bots.set(courier.token, {
        id: courier.id,
        username: courier.username,
        first_name: "Zumda Kuryer",
    })
    return bots
}

function botFor(bots: Map<string, Bot>, token: string): Bot | null {
    const known = bots.get(token)
    if (known) {
        return known
    }
    const fresh = NEW_BOT_TOKEN_PATTERN.exec(token)
    if (!fresh?.[1]) {
        return null
    }
    const id = Number(fresh[1])
    return { id, username: newBotUsername(id), first_name: "New shop" }
}

export interface RecordedFile {
    name: string
    contentType: string
    size: number
    base64: string
}

async function readBytes(request: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = []
    for await (const chunk of request) {
        chunks.push(chunk as Buffer)
    }
    return Buffer.concat(chunks)
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
    const text = (await readBytes(request)).toString("utf8")
    return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

/** A Bot API call body: JSON, or multipart form data with files. */
async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
    const type = request.headers["content-type"] ?? ""
    if (!type.startsWith("multipart/form-data")) {
        return readJson(request)
    }
    const form = await new Request("http://fake", {
        method: "POST",
        headers: { "Content-Type": type },
        body: new Uint8Array(await readBytes(request)),
    }).formData()
    const entries: [string, FormDataEntryValue][] = []
    form.forEach((value, key) => entries.push([key, value]))
    const body: Record<string, unknown> = {}
    for (const [key, value] of entries) {
        if (typeof value === "string") {
            body[key] = value
            continue
        }
        const bytes = Buffer.from(await value.arrayBuffer())
        const file: RecordedFile = {
            name: value.name,
            contentType: value.type,
            size: bytes.length,
            base64: bytes.toString("base64"),
        }
        body[key] = file
    }
    return body
}

function send(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { "Content-Type": "application/json" })
    response.end(JSON.stringify(body))
}

const fail = (status: number, description: string): [number, unknown] => [
    status,
    { ok: false, error_code: status, description },
]

/** Calls that only change a setting: Telegram answers `true`. */
const ALWAYS_OK = new Set([
    "editMessageText",
    "answerCallbackQuery",
    "setChatMenuButton",
    "setMyCommands",
    "setMyDescription",
    "setMyShortDescription",
])

/** Telegram takes a JPEG attached by name: anything else is a bad request. */
function photoAnswer(call: BotCall): [number, unknown] {
    const photo = JSON.parse(String(call.body["photo"] ?? "{}")) as { photo?: string }
    const file = call.body[photo.photo?.replace("attach://", "") ?? ""] as RecordedFile | undefined
    return file?.contentType === "image/jpeg" && file.size > 0
        ? [200, { ok: true, result: true }]
        : fail(400, "Bad Request: PHOTO_INVALID")
}

/** Like Telegram: the bot's current token; a managed bot starts at its first one. */
function currentManagedToken(state: State, botId: number): string {
    const version = state.managedTokens.get(botId) ?? 1
    state.managedTokens.set(botId, version)
    return managedBotToken(botId, version)
}

/** «Revoke token» in BotFather, or `replaceManagedBotToken`: the next token. */
function rotateManagedToken(state: State, botId: number): string {
    state.managedTokens.set(botId, (state.managedTokens.get(botId) ?? 1) + 1)
    return currentManagedToken(state, botId)
}

function answer(state: State, bot: Bot, call: BotCall): [number, unknown] {
    const chatId = Number(call.body["chat_id"])
    switch (call.method) {
        case "getMe":
            return [200, { ok: true, result: { ...bot, is_bot: true } }]
        case "sendMessage":
        case "sendPhoto":
            if (state.blocked.has(chatId)) {
                return fail(403, "Forbidden: bot was blocked by the user")
            }
            if (state.broken.has(chatId)) {
                return fail(500, "Internal Server Error")
            }
            return [200, { ok: true, result: { message_id: state.nextMessageId++ } }]
        case "setWebhook":
            return state.failWebhooks ? fail(502, "Bad Gateway") : [200, { ok: true, result: true }]
        case "sendDocument":
            if (state.blocked.has(chatId)) {
                return fail(403, "Forbidden: bot was blocked by the user")
            }
            return [200, { ok: true, result: { message_id: state.nextMessageId++ } }]
        case "setMyProfilePhoto":
            return photoAnswer(call)
        case "savePreparedKeyboardButton":
            return [200, { ok: true, result: { id: `prepared-${call.seq}` } }]
        case "getManagedBotToken":
            return [
                200,
                { ok: true, result: currentManagedToken(state, Number(call.body["user_id"])) },
            ]
        case "replaceManagedBotToken":
            return [
                200,
                { ok: true, result: rotateManagedToken(state, Number(call.body["user_id"])) },
            ]
        default:
            return ALWAYS_OK.has(call.method)
                ? [200, { ok: true, result: true }]
                : fail(404, `Not Found: method ${call.method}`)
    }
}

async function handle(
    state: State,
    bots: Map<string, Bot>,
    request: IncomingMessage,
    response: ServerResponse,
): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost")
    if (url.pathname === "/__log") {
        send(response, 200, state.calls)
        return
    }
    if (url.pathname === "/__reset") {
        state.calls.length = 0
        state.broken.clear()
        state.blocked.clear()
        state.failWebhooks = false
        state.managedTokens.clear()
        send(response, 200, { ok: true })
        return
    }
    if (url.pathname === "/__control") {
        const body = await readJson(request)
        state.broken = new Set((body["broken"] as number[] | undefined) ?? [...state.broken])
        state.blocked = new Set((body["blocked"] as number[] | undefined) ?? [...state.blocked])
        state.failWebhooks = (body["failWebhooks"] as boolean | undefined) ?? state.failWebhooks
        const revoked = body["revokeManagedBot"] as number | undefined
        if (revoked !== undefined) {
            rotateManagedToken(state, revoked)
        }
        send(response, 200, { ok: true })
        return
    }
    const match = /^\/bot([^/]+)\/(\w+)$/.exec(url.pathname)
    if (!match?.[1] || !match[2]) {
        send(response, 404, { ok: false, description: "Not Found" })
        return
    }
    const token = decodeURIComponent(match[1])
    const bot = botFor(bots, token)
    if (!bot) {
        send(response, 401, { ok: false, error_code: 401, description: "Unauthorized" })
        return
    }
    const call: BotCall = {
        seq: state.calls.length + 1,
        token,
        method: match[2],
        body: await readBody(request),
    }
    state.calls.push(call)
    const [status, body] = answer(state, bot, call)
    send(response, status, body)
}

export function startFakeTelegram(port: number): Promise<Server> {
    const bots = knownBots()
    const state: State = {
        calls: [],
        broken: new Set(),
        blocked: new Set(),
        failWebhooks: false,
        nextMessageId: 1000,
        managedTokens: new Map(),
    }
    const server = createServer((request, response) => {
        handle(state, bots, request, response).catch((error: unknown) => {
            send(response, 500, { ok: false, description: String(error) })
        })
    })
    return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)))
}
