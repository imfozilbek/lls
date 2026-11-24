/**
 * A fake Telegram Bot API for the local stand. The Worker sends every bot call here
 * (TELEGRAM_API_BASE); tests read what each bot "sent" and switch on failures.
 *
 *   POST /bot<token>/<method>   the Bot API methods Zumda uses (sendPhoto, sendVideo take a URL);
 *                               Managed Bots: a token stays until it is revoked or replaced
 *   GET  /.well-known/jwks.json Telegram Login's public keys (the stand's test key)
 *   POST /ors/v2/directions/driving-car/geojson
 *                               a fake OpenRouteService: the way turns at right angles, like
 *                               streets (recorded as method "ors")
 *   GET  /s/<username>          a public channel's web page (`t.me/s`), twenty posts a page, the
 *                               oldest first (`?before=<id>`); a channel without pages: a 302
 *   GET  /__log                 every recorded call, oldest first
 *   POST /__reset               forget calls and failures
 *   POST /__control             { broken?: number[], blocked?: number[], failWebhooks?: boolean,
 *                                 revokeManagedBot?: number (the owner's «Revoke token»),
 *                                 channelPages?: { <username>: PagePost[] },
 *                                 buttonsRetryAfter?: number (the next button in a channel: 429) }
 *
 * Files (sendDocument, setMyProfilePhoto) come as multipart: the call body keeps the text
 * fields, and the file as `{ name, contentType, size, base64 }` under its field name.
 */
import { createServer } from "node:http"

import {
    DEV_SHOPS,
    NEW_BOT_TOKEN_PATTERN,
    adminBot,
    businessBot,
    courierBot,
    managedBotToken,
    newBotUsername,
    platformBot,
} from "./config.js"
import { STAND_LOGIN_PUBLIC_JWK } from "./login-key.js"

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
    /**
     * `<bot username>:<chat id>`: this person never pressed Start in this bot, so it may not
     * write first (403), like a shop bot made with «Bot yaratish» that its owner never opened.
     */
    notStarted: Set<string>
    failWebhooks: boolean
    nextMessageId: number
    /** How many tokens each managed bot got so far. */
    managedTokens: Map<number, number>
    /** Public channels' past, by username (lower case). */
    channelPages: Map<string, PagePost[]>
    /** The next `editMessageReplyMarkup` in a channel: «Too Many Requests: retry after N». */
    buttonsRetryAfter: number | null
}

/** One post of a channel's past as its web page shows it. */
export interface PagePost {
    id: number
    text?: string
    album?: boolean
}

const CHANNEL_PAGE = 20

/** `t.me/s/<username>` as Telegram writes it: the posts before `before`, the oldest first. */
function channelPage(posts: readonly PagePost[], before: number | null): string {
    const older = posts
        .filter((post) => before === null || post.id < before)
        .sort((a, b) => b.id - a.id)
    const shown = older.slice(0, CHANNEL_PAGE).reverse()
    const first = shown[0]
    const more =
        older.length > CHANNEL_PAGE && first
            ? `<div class="tme_messages_more js-messages_more" data-before="${first.id}"></div>`
            : ""
    const items = shown.map((post) => {
        const at = new Date(Date.UTC(2026, 10, 1, 9, post.id)).toISOString()
        const album = post.album ? '<div class="tgme_widget_message_grouped_wrap"></div>' : ""
        const text = post.text
            ? `<div class="tgme_widget_message_text js-message_text"><div class="tgme_widget_message_text js-message_text">${post.text}</div></div>`
            : ""
        return `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message js-widget_message" data-post="channel/${post.id}">${album}${text}<a class="tgme_widget_message_date"><time datetime="${at}">09:00</time></a></div></div>`
    })
    return `<!DOCTYPE html><html><body><section>${more}${items.join("\n")}</section></body></html>`
}

function serveChannelPage(state: State, url: URL, response: ServerResponse): void {
    const username = decodeURIComponent(url.pathname.slice("/s/".length)).toLowerCase()
    const posts = state.channelPages.get(username)
    if (!posts) {
        response.writeHead(302, { Location: `/${username}` })
        response.end()
        return
    }
    const before = Number(url.searchParams.get("before")) || null
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    response.end(channelPage(posts, before))
}

/** Telegram asked to slow down once, for the next button under a channel's post. */
function buttonsRefused(state: State, call: BotCall): [number, unknown] | null {
    const wait = state.buttonsRetryAfter
    if (call.method !== "editMessageReplyMarkup" || wait === null) {
        return null
    }
    if (Number(call.body["chat_id"]) >= 0) {
        return null
    }
    state.buttonsRetryAfter = null
    return [
        429,
        {
            ok: false,
            error_code: 429,
            description: `Too Many Requests: retry after ${wait}`,
            parameters: { retry_after: wait },
        },
    ]
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
    const admin = adminBot()
    bots.set(admin.token, {
        id: admin.id,
        username: admin.username,
        first_name: "Zumda | Platforma",
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
    "deleteMessage",
    "editMessageReplyMarkup",
    "answerCallbackQuery",
    "setChatMenuButton",
    "setMyCommands",
    "setMyDescription",
    "setMyShortDescription",
    "sendChatAction",
    // The shop's channel: a post's new price, and the bot leaving a channel.
    "editMessageCaption",
    "leaveChat",
    // The support group: a spare topic deleted, a topic's icon or name, reopened, its card pinned.
    "deleteForumTopic",
    "editForumTopic",
    "reopenForumTopic",
    "pinChatMessage",
])

/** Telegram's set of topic icons (a few of them): the support group's ❓ and ✅ are there. */
const TOPIC_ICONS = [
    { emoji: "❓", custom_emoji_id: "icon-waiting", type: "custom_emoji" },
    { emoji: "✅", custom_emoji_id: "icon-answered", type: "custom_emoji" },
    { emoji: "🔥", custom_emoji_id: "icon-fire", type: "custom_emoji" },
]

/** Telegram's count of a channel's subscribers, shown on «Telegram kanal». */
const CHANNEL_SUBSCRIBERS = 231

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

const WRITES = new Set([
    "sendMessage",
    "sendPhoto",
    "sendVideo",
    "sendDocument",
    "sendChatAction",
    "copyMessage",
])

/**
 * Telegram refuses a message to someone who blocked the bot or never pressed Start in it, and
 * fails (500) for a chat in an outage (messages, photos and videos only).
 */
function refused(state: State, bot: Bot, call: BotCall): [number, unknown] | null {
    const chatId = Number(call.body["chat_id"])
    if (!WRITES.has(call.method)) {
        return null
    }
    if (state.notStarted.has(`${bot.username}:${chatId}`)) {
        return fail(403, "Forbidden: bot can't initiate conversation with a user")
    }
    if (state.blocked.has(chatId)) {
        return fail(403, "Forbidden: bot was blocked by the user")
    }
    const outage = ["sendMessage", "sendPhoto", "sendVideo"].includes(call.method)
    return outage && state.broken.has(chatId) ? fail(500, "Internal Server Error") : null
}

/** A photo file (a channel post) comes back with Telegram's id of it, sent again later. */
function sentPhoto(state: State, call: BotCall): [number, unknown] {
    const id = state.nextMessageId++
    const file = typeof call.body["photo"] === "object"
    const photo = file ? { photo: [{ file_id: `file-${id}`, width: 1280, height: 1280 }] } : {}
    return [200, { ok: true, result: { message_id: id, ...photo } }]
}

/** Whatever Telegram would refuse this call for: the person, an outage, a pause it asked for. */
function refusalOf(state: State, bot: Bot, call: BotCall): [number, unknown] | null {
    return refused(state, bot, call) ?? buttonsRefused(state, call)
}

/**
 * The support group: a copied message, and a new topic (its id is its first message's); any
 * other method is unknown to Telegram.
 */
function otherAnswer(state: State, call: BotCall): [number, unknown] {
    if (ALWAYS_OK.has(call.method)) {
        return [200, { ok: true, result: true }]
    }
    if (call.method === "copyMessage") {
        return [200, { ok: true, result: { message_id: state.nextMessageId++ } }]
    }
    if (call.method === "getForumTopicIconStickers") {
        return [200, { ok: true, result: TOPIC_ICONS }]
    }
    if (call.method === "createForumTopic") {
        const topic = { message_thread_id: state.nextMessageId++, name: call.body["name"] }
        return [200, { ok: true, result: { ...topic, icon_color: 0 } }]
    }
    return fail(404, `Not Found: method ${call.method}`)
}

function answer(state: State, bot: Bot, call: BotCall): [number, unknown] {
    const refusal = refusalOf(state, bot, call)
    if (refusal) {
        return refusal
    }
    switch (call.method) {
        case "getMe":
            return [200, { ok: true, result: { ...bot, is_bot: true } }]
        case "sendPhoto":
            return sentPhoto(state, call)
        case "sendMessage":
        case "sendVideo":
        case "sendDocument":
            return [200, { ok: true, result: { message_id: state.nextMessageId++ } }]
        case "getChatMemberCount":
            return [200, { ok: true, result: CHANNEL_SUBSCRIBERS }]
        case "setWebhook":
            return state.failWebhooks ? fail(502, "Bad Gateway") : [200, { ok: true, result: true }]
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
            return otherAnswer(state, call)
    }
}

const ORS_PATH = "/ors/v2/directions/driving-car/geojson"
const METERS_PER_DEGREE = 111_320
const STAND_SPEED_MPS = 8

/** A way through the points that turns at right angles (east-west, then north-south). */
function fakeRoute(points: [number, number][]): object {
    const line: [number, number][] = []
    let meters = 0
    points.forEach((point, i) => {
        const previous = points[i - 1]
        if (previous) {
            line.push([point[0], previous[1]])
            meters +=
                (Math.abs(point[0] - previous[0]) * 0.78 + Math.abs(point[1] - previous[1])) *
                METERS_PER_DEGREE
        }
        line.push(point)
    })
    return {
        features: [
            {
                geometry: { coordinates: line },
                properties: { summary: { distance: meters, duration: meters / STAND_SPEED_MPS } },
            },
        ],
    }
}

async function serveOrs(
    state: State,
    request: IncomingMessage,
    response: ServerResponse,
): Promise<void> {
    const body = await readJson(request)
    state.calls.push({ seq: state.calls.length + 1, token: "ors", method: "ors", body })
    const points = (body["coordinates"] as [number, number][] | undefined) ?? []
    send(response, 200, fakeRoute(points))
}

/** `/__control`: what a test makes Telegram do; a field left out keeps its value. */
function applyControl(state: State, body: Record<string, unknown>): void {
    state.broken = new Set((body["broken"] as number[] | undefined) ?? [...state.broken])
    state.blocked = new Set((body["blocked"] as number[] | undefined) ?? [...state.blocked])
    state.notStarted = new Set(
        (body["notStarted"] as string[] | undefined) ?? [...state.notStarted],
    )
    state.failWebhooks = (body["failWebhooks"] as boolean | undefined) ?? state.failWebhooks
    const pages = body["channelPages"] as Record<string, PagePost[]> | undefined
    for (const [username, posts] of Object.entries(pages ?? {})) {
        state.channelPages.set(username.toLowerCase(), posts)
    }
    const wait = body["buttonsRetryAfter"] as number | undefined
    if (wait !== undefined) {
        state.buttonsRetryAfter = wait
    }
    const revoked = body["revokeManagedBot"] as number | undefined
    if (revoked !== undefined) {
        rotateManagedToken(state, revoked)
    }
}

async function handle(
    state: State,
    bots: Map<string, Bot>,
    request: IncomingMessage,
    response: ServerResponse,
): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost")
    // Telegram Login's public keys: the stand signs `id_token`s with the matching private key.
    if (url.pathname === "/.well-known/jwks.json") {
        send(response, 200, { keys: [STAND_LOGIN_PUBLIC_JWK] })
        return
    }
    if (url.pathname === ORS_PATH) {
        await serveOrs(state, request, response)
        return
    }
    if (url.pathname.startsWith("/s/")) {
        serveChannelPage(state, url, response)
        return
    }
    if (url.pathname === "/__log") {
        send(response, 200, state.calls)
        return
    }
    if (url.pathname === "/__reset") {
        state.calls.length = 0
        state.broken.clear()
        state.blocked.clear()
        state.notStarted.clear()
        state.failWebhooks = false
        state.managedTokens.clear()
        state.channelPages.clear()
        state.buttonsRetryAfter = null
        send(response, 200, { ok: true })
        return
    }
    if (url.pathname === "/__control") {
        applyControl(state, await readJson(request))
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
        notStarted: new Set(),
        failWebhooks: false,
        nextMessageId: 1000,
        managedTokens: new Map(),
        channelPages: new Map(),
        buttonsRetryAfter: null,
    }
    const server = createServer((request, response) => {
        handle(state, bots, request, response).catch((error: unknown) => {
            send(response, 500, { ok: false, description: String(error) })
        })
    })
    return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)))
}
