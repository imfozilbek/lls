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

    /** Telegram's news is about this channel (not one the bot left before). */
    isSameChat(chatId: number): boolean {
        return this.props.chatId === chatId
    }
}
