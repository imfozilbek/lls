import { ValidationError } from "../errors/validation.error.js"
import { requireText } from "../shared/guards.js"

/** Telegram's limits: a chat title, and a forum topic's name. */
const TITLE_MAX = 128
const TOPIC_NAME_MAX = 128

export interface SupportGroupProps {
    businessId: string
    /** Telegram's id of the group: negative, `-100…` (a supergroup with topics). */
    chatId: number
    title: string
    connectedAt: Date
}

/**
 * The shop's closed group with topics, where the shop's bot is an admin who may manage topics
 * (owner's decision, November 2026): a customer's messages to the shop's bot come to their own
 * topic there, and what the shop's people write in that topic goes back to the customer from the
 * shop's bot. One per shop; the row exists only while the bot may make topics there.
 */
export class SupportGroup {
    private constructor(private readonly props: SupportGroupProps) {}

    static connect(props: SupportGroupProps): SupportGroup {
        if (!Number.isSafeInteger(props.chatId) || props.chatId >= 0) {
            throw ValidationError.fromField("chatId", "Must be a group's id", props.chatId)
        }
        return new SupportGroup({
            ...props,
            title: requireText("title", props.title, TITLE_MAX),
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

    get connectedAt(): Date {
        return this.props.connectedAt
    }

    /** Telegram's news is about this group (not one the bot left before). */
    isSameChat(chatId: number): boolean {
        return this.props.chatId === chatId
    }

    /** The same group under its new title. */
    renamed(title: string): SupportGroup {
        return SupportGroup.connect({ ...this.props, title })
    }
}

/** A customer's own topic in the shop's support group. */
export interface SupportThread {
    businessId: string
    /** The group the topic is in: a topic of a group connected before means nothing now. */
    chatId: number
    customerTelegramId: number
    threadId: number
    createdAt: Date
}

/** What a customer is called in Telegram, as a topic's name: never empty, never too long. */
export function supportTopicName(
    name: { firstName?: string; lastName?: string },
    fallback: string,
): string {
    const full = [name.firstName, name.lastName]
        .map((part) => part?.trim() ?? "")
        .filter((part) => part !== "")
        .join(" ")
    const picked = full === "" ? fallback : full
    return [...picked].slice(0, TOPIC_NAME_MAX).join("")
}
