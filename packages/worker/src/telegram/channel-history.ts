import type { ChannelHistoryReader, HistoryPage, HistoryPost } from "@zumda/core"

export const TELEGRAM_WEB_BASE = "https://t.me"
/** Hosts a local stand may point the channel pages at; anything else falls back to Telegram. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"])

/**
 * Where a public channel's web page lives. A local stand sets `TELEGRAM_WEB_BASE` to a fake
 * Telegram on localhost; any other value is ignored.
 */
export function telegramWebBase(configured: string | undefined): string {
    if (!configured) {
        return TELEGRAM_WEB_BASE
    }
    try {
        const url = new URL(configured)
        const local = url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)
        return local ? url.origin : TELEGRAM_WEB_BASE
    } catch {
        return TELEGRAM_WEB_BASE
    }
}

const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
}
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi
const HEX = 16
const DECIMAL = 10

/** The page's text as written: `&#33;` is «!», `&amp;` is «&». */
export function decodeEntities(text: string): string {
    return text.replace(ENTITY, (whole, name: string) => {
        if (name.startsWith("#")) {
            const hex = name[1] === "x" || name[1] === "X"
            const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? HEX : DECIMAL)
            return Number.isFinite(code) && code > 0 && code <= 0x10ffff
                ? String.fromCodePoint(code)
                : whole
        }
        return NAMED_ENTITIES[name.toLowerCase()] ?? whole
    })
}

/** One post as the page is read: its pieces of text come one by one. */
interface PostBeingRead {
    messageId: number
    album: boolean
    /** A service line («channel created», «pinned») or a post with another bot's buttons. */
    skip: boolean
    text: string[]
    date?: Date
}

const POST_ID = /\/(\d+)$/
const SERVICE = /\bservice_message\b/

/** What a page says: its posts, oldest first, as the page shows them. */
class PageReader {
    readonly posts: PostBeingRead[] = []
    older = false

    private get current(): PostBeingRead | undefined {
        return this.posts.at(-1)
    }

    rewriter(): HTMLRewriter {
        return new HTMLRewriter()
            .on(".tgme_widget_message[data-post]", {
                element: (element) => {
                    const id = POST_ID.exec(element.getAttribute("data-post") ?? "")?.[1]
                    if (id === undefined) {
                        return
                    }
                    this.posts.push({
                        messageId: Number(id),
                        album: false,
                        skip: SERVICE.test(element.getAttribute("class") ?? ""),
                        text: [],
                    })
                },
            })
            .on(".tgme_widget_message_grouped_wrap", {
                element: () => {
                    const post = this.current
                    if (post) {
                        post.album = true
                    }
                },
            })
            .on(".tgme_widget_message_inline_keyboard, .tgme_widget_message_inline_button", {
                element: () => {
                    const post = this.current
                    if (post) {
                        post.skip = true
                    }
                },
            })
            .on(".tgme_widget_message_text.js-message_text", {
                text: (chunk) => {
                    this.current?.text.push(chunk.text)
                },
            })
            .on(".tgme_widget_message_text.js-message_text br", {
                element: () => {
                    this.current?.text.push("\n")
                },
            })
            .on(".tgme_widget_message_date time[datetime]", {
                element: (element) => {
                    const post = this.current
                    const at = new Date(element.getAttribute("datetime") ?? "")
                    if (post && !Number.isNaN(at.getTime())) {
                        post.date = at
                    }
                },
            })
            .on(".tme_messages_more[data-before]", {
                element: () => {
                    this.older = true
                },
            })
    }
}

function toPost(read: PostBeingRead): HistoryPost {
    const text = decodeEntities(read.text.join("")).trim()
    return {
        messageId: read.messageId,
        album: read.album,
        ...(text ? { text } : {}),
        ...(read.date ? { date: read.date } : {}),
    }
}

/** The posts of one page, newest first (where the next page goes on from), and whether more. */
export async function readChannelPage(response: Response): Promise<HistoryPage> {
    const reader = new PageReader()
    await reader.rewriter().transform(response).arrayBuffer()
    const seen = new Set<number>()
    const posts = reader.posts
        .filter((post) => {
            const fresh = !seen.has(post.messageId)
            seen.add(post.messageId)
            return fresh && !post.skip
        })
        .map(toPost)
        .sort((a, b) => b.messageId - a.messageId)
    return { posts, older: reader.older }
}

const PAGE_HEADERS = { "User-Agent": "Mozilla/5.0", "Accept-Language": "uz" }
const SERVER_ERROR = 500

/** Telegram's channel page could not be reached now: the owner presses again later. */
export class ChannelPageError extends Error {
    constructor(reason: string) {
        super(`Channel page not read: ${reason}`)
        this.name = "ChannelPageError"
    }
}

/**
 * A public channel's past (owner's decision, November 2026: the bot reads it itself). Telegram's
 * Bot API keeps no history, so the channel's own web page `t.me/s/<username>` is read, one page
 * of about twenty posts a call. A channel whose page Telegram does not show (private, or turned
 * off: it sends the person to the channel's card) answers null; Telegram not answering throws.
 */
export class WebChannelHistory implements ChannelHistoryReader {
    /** The default calls the global `fetch` unbound: workerd throws "Illegal invocation" otherwise. */
    constructor(
        private readonly fetcher: typeof fetch = (input, init): Promise<Response> =>
            fetch(input, init),
        private readonly base: string = TELEGRAM_WEB_BASE,
    ) {}

    async page(username: string, before?: number): Promise<HistoryPage | null> {
        const query = before === undefined ? "" : `?before=${before}`
        let response: Response
        try {
            response = await this.fetcher(
                `${this.base}/s/${encodeURIComponent(username)}${query}`,
                { headers: PAGE_HEADERS, redirect: "manual" },
            )
        } catch (error) {
            // The message may carry the URL: only the kind of failure.
            throw new ChannelPageError(error instanceof Error ? error.name : "unknown")
        }
        if (response.ok) {
            return readChannelPage(response)
        }
        await response.body?.cancel()
        if (response.status >= SERVER_ERROR) {
            throw new ChannelPageError(`HTTP ${response.status}`)
        }
        return null
    }
}
