import { ValidationError } from "../errors/validation.error.js"
import { requireText } from "../shared/guards.js"

import { formatPhone } from "./phone.js"

/** Telegram's limits: a chat title, and a forum topic's name. */
const TITLE_MAX = 128
const TOPIC_NAME_MAX = 128
/**
 * The customer's name in a topic's name: a phone shows about 25-30 characters of a topic in the
 * list, so the name is cut to leave room for the number after it.
 */
const TOPIC_PERSON_MAX = 20
/** «+998 90 123 45 67» reads «90 123 45 67» in a list of Uzbek shops' customers. */
const UZ_PREFIX = "+998 "
const SEPARATOR = " · "

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
    /** The customer asked and nobody of the shop answered yet (the topic shows ❓). */
    waitingSince?: Date
    /** The pinned card at the top of the topic: who the customer is, their orders. */
    cardMessageId?: number
    /** The name the topic has now: renamed only when it would change. */
    topicName?: string
}

/** Who the customer is, as Telegram and this shop know them. */
export interface SupportPerson {
    firstName?: string
    lastName?: string
    username?: string
    /** The phone they gave THIS shop (E.164), never one given only to another shop. */
    phone?: string
}

/** «90 123 45 67» for an Uzbek number, the whole number otherwise. */
export function shortPhone(e164: string): string {
    const formatted = formatPhone(e164)
    return formatted.startsWith(UZ_PREFIX) ? formatted.slice(UZ_PREFIX.length) : formatted
}

function cut(text: string, max: number): string {
    return [...text].slice(0, max).join("")
}

/**
 * A topic's name (owner's decision, November 2026): «Aziz Karimov · 90 123 45 67», the name cut to
 * 20 characters; without a phone given to this shop «Aziz Karimov · @aziz», without either just
 * the name; no name: `fallback`. Never empty, never over Telegram's 128.
 */
export function supportTopicName(person: SupportPerson, fallback: string): string {
    const full = [person.firstName, person.lastName]
        .map((part) => part?.trim() ?? "")
        .filter((part) => part !== "")
        .join(" ")
    const name = cut(full === "" ? fallback : full, TOPIC_PERSON_MAX).trim()
    const username = person.username?.trim()
    const tail = person.phone ? shortPhone(person.phone) : username ? `@${username}` : undefined
    return cut(tail ? `${name}${SEPARATOR}${tail}` : name, TOPIC_NAME_MAX)
}

/** Why the shop's group was not connected, or was lost: the app says it. */
export type SupportRefusalReason = "notOwner" | "demo" | "notForum" | "noTopics" | "lost"

export interface SupportRefusal {
    businessId: string
    reason: SupportRefusalReason
    /** The group's title as Telegram gave it. */
    title: string
    at: Date
}
