import { ValidationError } from "../errors/validation.error.js"
import { optionalText, requireText } from "../shared/guards.js"

/** Telegram's limits: a chat title, and a public username after `t.me/`. */
const TITLE_MAX = 128
const USERNAME = /^[A-Za-z0-9_]{4,32}$/
/** A channel's id is its public id after this prefix: `-1001234567890` is `t.me/c/1234567890`. */
const CHANNEL_ID_PREFIX = "-100"

export interface ShopChannelProps {
    businessId: string
    /** Telegram's id of the channel: negative, `-100…`. */
    chatId: number
    title: string
    /** The public username; a private channel has none. */
    username?: string
    connectedAt: Date
    /**
     * The set of updates the shop's bot was last registered for (`SHOP_BOT_UPDATES_VERSION` in
     * the Worker): 0 until the bot hears the channel's own posts.
     */
    updatesVersion?: number
    /** The older posts read so far: the next page is the one before this message. */
    historyBefore?: number
    /** Every older post was read. */
    historyDoneAt?: Date
}

/**
 * The shop's own Telegram channel, where the shop's bot is an admin (owner's decision, November
 * 2026): the owner posts products to it from the Mini App. One per shop; the row exists only
 * while the bot may post there.
 */
export class ShopChannel {
    private constructor(private readonly props: ShopChannelProps) {}

    static connect(props: ShopChannelProps): ShopChannel {
        if (!Number.isSafeInteger(props.chatId) || props.chatId >= 0) {
            throw ValidationError.fromField("chatId", "Must be a channel's id", props.chatId)
        }
        const username = optionalText("username", props.username, TITLE_MAX)
        if (username !== undefined && !USERNAME.test(username)) {
            throw ValidationError.fromField("username", "Must be a Telegram username", username)
        }
        return new ShopChannel({
            ...props,
            title: requireText("title", props.title, TITLE_MAX),
            ...(username === undefined ? {} : { username }),
        })
    }

    get businessId(): string {
        return this.props.businessId
    }

    get chatId(): number {
        return this.props.chatId
    }

    get title(): string {
        return this.props.title
    }

    get username(): string | undefined {
        return this.props.username
    }

    get connectedAt(): Date {
        return this.props.connectedAt
    }

    /** The post in Telegram: by the username for a public channel, by the id for a private one. */
    postUrl(messageId: number): string {
        if (this.props.username) {
            return `https://t.me/${this.props.username}/${messageId}`
        }
        const id = String(this.props.chatId)
        const bare = id.startsWith(CHANNEL_ID_PREFIX) ? id.slice(CHANNEL_ID_PREFIX.length) : id
        return `https://t.me/c/${bare.replace("-", "")}/${messageId}`
    }

    get updatesVersion(): number {
        return this.props.updatesVersion ?? 0
    }

    get historyBefore(): number | undefined {
        return this.props.historyBefore
    }

    /** When the bot read the channel's past to its first post. */
    get historyDoneAt(): Date | undefined {
        return this.props.historyDoneAt
    }

    get historyDone(): boolean {
        return this.props.historyDoneAt !== undefined
    }

    /** Only a public channel shows its older posts on its web page. */
    get isPublic(): boolean {
        return this.props.username !== undefined
    }

    /** The same channel, its bot registered for this set of updates. */
    withUpdates(version: number): ShopChannel {
        return new ShopChannel({ ...this.props, updatesVersion: version })
    }

    /** The same channel, its older posts read down to `before`, or all of them (`done`). */
    withHistory(state: { before?: number; doneAt?: Date }): ShopChannel {
        const { historyBefore: _b, historyDoneAt: _d, ...rest } = this.props
        return new ShopChannel({
            ...rest,
            ...(state.before === undefined ? {} : { historyBefore: state.before }),
            ...(state.doneAt === undefined ? {} : { historyDoneAt: state.doneAt }),
        })
    }

    /** What survives a new title or a co-admin's change: the bot's updates and the history read. */
    keepsStateOf(before: ShopChannel): ShopChannel {
        return new ShopChannel({
            ...this.props,
            ...(before.props.updatesVersion === undefined
                ? {}
                : { updatesVersion: before.props.updatesVersion }),
            ...(before.props.historyBefore === undefined
                ? {}
                : { historyBefore: before.props.historyBefore }),
            ...(before.props.historyDoneAt === undefined
                ? {}
                : { historyDoneAt: before.props.historyDoneAt }),
        })
    }

    /** Telegram's news is about this channel (not one the bot left before). */
    isSameChat(chatId: number): boolean {
        return this.props.chatId === chatId
    }
}
