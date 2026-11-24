import { Language, OpenSupportThreadUseCase } from "@zumda/core"

import { isRecipientProblem } from "../alerts.js"
import { TOPIC_GONE, TelegramApiError, escapeHtml } from "../telegram/gateway.js"
import { Notifier } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"
import { hasContent } from "../telegram/updates.js"

import {
    completeOldTopic,
    groupTexts,
    postTopicCard,
    showTopicStatus,
    statusIcons,
    supportOrderLine,
    topicCardText,
    topicNameOf,
} from "./support-topics.js"

import type { Services } from "../services.js"
import type { BotTexts } from "../telegram/texts.js"
import type { ChatMemberUpdate, IncomingMessage } from "../telegram/updates.js"
import type {
    Business,
    SupportGroup,
    SupportAbout,
    SupportPerson,
    SupportProfile,
    SupportRoute,
    SupportTopics,
    TopicOutcome,
} from "@zumda/core"

/** Telegram's words for the bot's place in a chat. */
const ADMINISTRATOR = "administrator"
const STILL_IN = new Set([ADMINISTRATOR, "member", "restricted"])
/** The chat types a support group may be: a plain group has no topics (refused as such). */
const GROUP_TYPES = new Set(["group", "supergroup"])
const PRIVATE = "private"

/** Telegram's answers when the bot may not make topics in the group any more. */
const NO_TOPIC_RIGHTS =
    /not enough rights|need administrator rights|CHAT_ADMIN_REQUIRED|not a member|kicked|chat not found|the chat is not a forum|CHAT_NOT_MODIFIED|Forbidden/i

/** `/start q_o<orderId>` or `q_p<productId>`: «Do'konga xabar yozish» in the app. */
const SUPPORT_START = /^\/start\s+q_([op])([A-Za-z0-9_-]{1,62})\s*$/

export type SupportStart = { orderId: string } | { productId: string }

export function parseSupportStart(text: string | undefined): SupportStart | null {
    const match = SUPPORT_START.exec(text?.trim() ?? "")
    if (!match) {
        return null
    }
    const [, kind, id = ""] = match
    return kind === "o" ? { orderId: id } : { productId: id }
}

function named(title: string): string {
    return `<b>«${escapeHtml(title)}»</b>`
}

/** The shop's support group through its own bot. */
class TelegramSupportTopics implements SupportTopics {
    constructor(
        private readonly services: Services,
        private readonly token: string,
    ) {}

    async open(group: SupportGroup, name: string): Promise<TopicOutcome> {
        try {
            // A new topic waits for the shop's answer from the start: its ❓ comes with it.
            const icons = await statusIcons(this.services, this.token)
            const topic = await this.services.telegram.createForumTopic(
                this.token,
                group.chatId,
                name,
                icons.waiting,
            )
            return { kind: "opened", threadId: topic.threadId }
        } catch (error) {
            if (error instanceof TelegramApiError && NO_TOPIC_RIGHTS.test(error.description)) {
                return { kind: "noRights" }
            }
            throw error
        }
    }

    async discard(group: SupportGroup, threadId: number): Promise<void> {
        await this.services.telegram.deleteForumTopic(this.token, group.chatId, threadId)
    }
}

/**
 * The shop's bot in a group (owner's decision, November 2026; goal 21): made an admin who may
 * make topics, by the owner, in a group with topics, it connects the shop's support group;
 * added by someone else, to a demo shop, to a group without topics or without that right, it
 * leaves at once and the owner hears why; removed, or the right taken, the group is forgotten.
 * News about a group the bot already left (the echo of its own leaving) changes nothing.
 */
export async function handleSupportMembership(
    services: Services,
    business: Business,
    token: string,
    update: ChatMemberUpdate,
    t: BotTexts,
): Promise<void> {
    const { chat, from, new_chat_member: member } = update
    if (!GROUP_TYPES.has(chat.type) || member.user.id !== business.bot.id) {
        return
    }
    const notifier = new Notifier(services)
    const title = chat.title ?? String(chat.id)
    if (!STILL_IN.has(member.status)) {
        const lost = await services.useCases.loseSupportGroup.execute({
            businessId: business.id,
            chatId: chat.id,
            now: services.clock.now(),
        })
        if (lost) {
            await notifier.channelNews(business, fill(t.supportLost, { group: named(lost.title) }))
        }
        return
    }
    const outcome = await services.useCases.connectSupportGroup.execute({
        businessId: business.id,
        actorTelegramId: from.id,
        chatId: chat.id,
        title,
        isForum: chat.type === "supergroup" && chat.is_forum === true,
        canManageTopics: member.status === ADMINISTRATOR && member.can_manage_topics === true,
        now: services.clock.now(),
    })
    switch (outcome.kind) {
        case "refused": {
            await services.telegram.leaveChat(token, chat.id)
            const news = {
                notOwner: t.supportNotByOwner,
                demo: t.supportDemo,
                notForum: t.supportNotForum,
                noTopics: t.supportNoTopics,
            }[outcome.why]
            await notifier.channelNews(business, fill(news, { group: named(title) }))
            return
        }
        case "lost":
            await notifier.channelNews(
                business,
                fill(t.supportLost, { group: named(outcome.group.title) }),
            )
            return
        case "connected":
            await connected(services, business, token, outcome, t)
            return
        case "unchanged":
            return
    }
}

async function connected(
    services: Services,
    business: Business,
    token: string,
    outcome: { group: SupportGroup; replaced?: SupportGroup },
    t: BotTexts,
): Promise<void> {
    if (outcome.replaced) {
        await services.telegram.leaveChat(token, outcome.replaced.chatId)
    }
    const g = groupTexts(business)
    await services.telegram.sendMessage(
        token,
        outcome.group.chatId,
        fill(g.supportHello, { bot: `@${escapeHtml(business.bot.username)}` }),
    )
    await new Notifier(services).channelNews(
        business,
        fill(t.supportConnected, { group: named(outcome.group.title) }),
    )
}

/** An anonymous admin writes as the group; any other bot is never copied to a customer. */
function writtenByPeople(message: IncomingMessage): boolean {
    if (message.sender_chat) {
        return message.sender_chat.id === message.chat.id
    }
    return message.from?.is_bot !== true
}

/**
 * A message in a group the shop's bot is in. Someone of the shop wrote in a customer's topic of
 * the connected support group: the bot copies it to the customer, as the shop. Anything else (the
 * General topic, a service note, another group) is left alone: the bot never talks in a group.
 */
export async function handleGroupMessage(
    services: Services,
    business: Business,
    token: string,
    message: IncomingMessage,
): Promise<void> {
    const threadId = message.message_thread_id
    const messageId = message.message_id
    if (
        message.is_topic_message !== true ||
        threadId === undefined ||
        messageId === undefined ||
        !hasContent(message) ||
        !writtenByPeople(message)
    ) {
        return
    }
    const customer = await services.useCases.findSupportCustomer.execute({
        businessId: business.id,
        chatId: message.chat.id,
        threadId,
    })
    if (customer === null) {
        return
    }
    try {
        await services.telegram.copyMessage(token, message.chat.id, messageId, customer)
    } catch (error) {
        if (!isRecipientProblem(error)) {
            throw error
        }
        await services.telegram.sendMessage(
            token,
            message.chat.id,
            groupTexts(business).supportCustomerGone,
            { threadId, replyTo: messageId, silent: true },
        )
    }
    // Answered (or the customer cannot hear it): nobody waits in this topic any more, its ✅.
    const answered = await services.useCases.markSupportAnswered.execute({
        businessId: business.id,
        chatId: message.chat.id,
        threadId,
    })
    if (answered) {
        await showTopicStatus(services, token, { chatId: message.chat.id, threadId }, false)
    }
}

export function isPrivate(message: IncomingMessage): boolean {
    return message.chat.type === undefined || message.chat.type === PRIVATE
}

function personOf(from: NonNullable<IncomingMessage["from"]>): SupportPerson {
    return {
        firstName: from.first_name,
        ...(from.last_name ? { lastName: from.last_name } : {}),
        ...(from.username ? { username: from.username } : {}),
    }
}

/**
 * The customer's topic: made with its pinned card and its name «Ism · telefon» when new; an
 * answered one shows ❓ again (and opens, if the shop's people closed it).
 */
async function routeOf(
    services: Services,
    business: Business,
    token: string,
    message: IncomingMessage,
    staleThreadId?: number,
): Promise<SupportRoute> {
    const from = message.from
    if (!from) {
        return { kind: "none" }
    }
    const person = personOf(from)
    // Read only for a new topic: its name and its card.
    let profile: SupportProfile | undefined
    const route = await new OpenSupportThreadUseCase({
        supportGroups: services.supportGroups,
        supportThreads: services.supportThreads,
        topics: new TelegramSupportTopics(services, token),
    }).execute({
        businessId: business.id,
        customerTelegramId: from.id,
        nameOf: async () => {
            profile = await services.useCases.supportContext.profile(business.id, from.id)
            return topicNameOf(business, person, profile)
        },
        ...(staleThreadId === undefined ? {} : { staleThreadId }),
        now: services.clock.now(),
    })
    if (route.kind === "lost") {
        const t = textsFor(Language.UZ, business.type)
        await new Notifier(services).channelNews(
            business,
            fill(t.supportLost, { group: named(route.group.title) }),
        )
    }
    if (route.kind === "thread" && route.created && profile) {
        const topic = {
            chatId: route.group.chatId,
            threadId: route.threadId,
            customerTelegramId: from.id,
        }
        await postTopicCard(services, token, topic, topicCardText(business, person, profile))
    }
    if (route.kind === "thread" && route.unnamed) {
        const old = {
            businessId: business.id,
            chatId: route.group.chatId,
            customerTelegramId: from.id,
            threadId: route.threadId,
            createdAt: services.clock.now(),
        }
        const known = await services.useCases.supportContext.profile(business.id, from.id)
        await completeOldTopic(services, token, old, { business, person, profile: known })
    }
    if (route.kind === "thread" && route.nowWaiting) {
        const topic = { chatId: route.group.chatId, threadId: route.threadId }
        await showTopicStatus(services, token, topic, true)
    }
    return route
}

function topicGone(error: unknown): boolean {
    return error instanceof TelegramApiError && TOPIC_GONE.test(error.description)
}

/**
 * Something for the customer's topic: sent there, or, when the shop's people deleted the topic,
 * sent to a new one made in its place (with its card). Null: the group is gone.
 */
async function intoTopic(
    services: Services,
    target: { business: Business; token: string; message: IncomingMessage },
    route: Extract<SupportRoute, { kind: "thread" }>,
    send: (to: { chatId: number; threadId: number }) => Promise<unknown>,
): Promise<Extract<SupportRoute, { kind: "thread" }> | null> {
    try {
        await send({ chatId: route.group.chatId, threadId: route.threadId })
        return route
    } catch (error) {
        if (!topicGone(error)) {
            throw error
        }
    }
    const { business, token, message } = target
    const fresh = await routeOf(services, business, token, message, route.threadId)
    if (fresh.kind !== "thread") {
        return null
    }
    await send({ chatId: fresh.group.chatId, threadId: fresh.threadId })
    return fresh
}

/**
 * A customer wrote to the shop's bot (not a command, not their phone): with a support group, the
 * message goes to their own topic there and the bot says so once, when the topic is new. False:
 * the shop has no support group, the bot answers as before.
 */
export async function relayCustomerMessage(
    services: Services,
    business: Business,
    token: string,
    message: IncomingMessage,
    t: BotTexts,
): Promise<boolean> {
    const messageId = message.message_id
    if (messageId === undefined || !hasContent(message)) {
        return false
    }
    const route = await routeOf(services, business, token, message)
    if (route.kind !== "thread") {
        return false
    }
    const sent = await intoTopic(services, { business, token, message }, route, (to) =>
        services.telegram.copyMessage(token, message.chat.id, messageId, to.chatId, {
            threadId: to.threadId,
        }),
    )
    if (!sent) {
        return false
    }
    if (sent.created) {
        await services.telegram.sendMessage(token, message.chat.id, t.supportSent)
    }
    return true
}

/** What «Do'konga xabar yozish» was pressed on, as the topic hears it and the customer is asked. */
function aboutWords(
    about: SupportAbout | null,
    t: BotTexts,
    g: BotTexts,
): { topic?: string; ask: string } {
    if (about?.kind === "order") {
        return {
            topic: supportOrderLine(g.supportAboutOrder, about.order, g),
            ask: fill(t.supportAskOrder, { n: about.order.number }),
        }
    }
    if (about?.kind === "product") {
        const product = escapeHtml(about.name)
        return {
            topic: fill(g.supportAboutProduct, { product }),
            ask: fill(t.supportAskProduct, { product }),
        }
    }
    return { ask: t.supportAsk }
}

/**
 * «Do'konga xabar yozish» in the app: `/start q_o<order>` or `q_p<product>`. The topic hears
 * what it is about (the customer's own order, a product of this shop: anything else is not told),
 * the customer is asked to write. False: no support group, the bot greets as before.
 */
export async function handleSupportStart(
    services: Services,
    business: Business,
    token: string,
    message: IncomingMessage,
    t: BotTexts,
): Promise<boolean> {
    const start = parseSupportStart(message.text)
    const from = message.from
    if (!start || !from) {
        return false
    }
    const route = await routeOf(services, business, token, message)
    if (route.kind !== "thread") {
        return false
    }
    const about = await services.useCases.supportContext.about({
        businessId: business.id,
        customerTelegramId: from.id,
        ...start,
    })
    const words = aboutWords(about, t, groupTexts(business))
    const topic = words.topic
    if (topic !== undefined) {
        const sent = await intoTopic(services, { business, token, message }, route, (to) =>
            services.telegram.sendMessage(token, to.chatId, topic, { threadId: to.threadId }),
        )
        if (!sent) {
            return false
        }
    }
    await services.telegram.sendMessage(token, message.chat.id, words.ask)
    return true
}
