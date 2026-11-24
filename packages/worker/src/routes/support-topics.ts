import { Language, formatPhone, supportTopicName } from "@zumda/core"

import { formatMoney } from "../telegram/format.js"
import { TOPIC_GONE, TelegramApiError, escapeHtml } from "../telegram/gateway.js"
import { fill, textsFor } from "../telegram/texts.js"

import type { Services } from "../services.js"
import type { TelegramGateway } from "../telegram/gateway.js"
import type { BotTexts } from "../telegram/texts.js"
import type {
    Business,
    OrderDTO,
    SupportOrderFacts,
    SupportPerson,
    SupportProfile,
    SupportThread,
} from "@zumda/core"

/**
 * How a customer's topic looks in the shop's support group (owner's decisions, November 2026;
 * goal 22): its icon says whether the customer waits for an answer (❓) or got one (✅), its name
 * «Ism · telefon» tells same-named customers apart, its pinned card says who they are here.
 */

/** Telegram's set of topic icons may lack one: the next in the list stands in for it. */
const WAITING_ICONS = ["❓", "❔", "❗"]
const ANSWERED_ICONS = ["✅", "✔", "👍"]
/** «✔️» and «✔» are one icon: the variation selector is not part of it. */
const VARIATION = /️/g
/** The card counts orders up to this; more read «10+». */
const ORDERS_SHOWN = 10

/** Telegram's answers when an edit changes nothing, or the message is gone. */
const NOT_MODIFIED = /message is not modified/i
const MESSAGE_GONE = /message to edit not found|MESSAGE_ID_INVALID/i

/** A topic's place: its group and its id. */
export interface TopicRef {
    chatId: number
    threadId: number
    customerTelegramId: number
}

interface StatusIcons {
    waiting?: string
    answered?: string
}

/** Asked once a gateway (a Worker process): the set does not change between messages. */
const iconSets = new WeakMap<TelegramGateway, Promise<StatusIcons>>()

function pick(ids: Map<string, string>, emojis: readonly string[]): string | undefined {
    for (const emoji of emojis) {
        const id = ids.get(emoji.replace(VARIATION, ""))
        if (id) {
            return id
        }
    }
    return undefined
}

async function loadIcons(telegram: TelegramGateway, token: string): Promise<StatusIcons> {
    const icons = await telegram.getForumTopicIcons(token)
    const ids = new Map(
        icons.map((icon) => [icon.emoji.replace(VARIATION, ""), icon.customEmojiId]),
    )
    const set: StatusIcons = {}
    const waiting = pick(ids, WAITING_ICONS)
    const answered = pick(ids, ANSWERED_ICONS)
    if (waiting) {
        set.waiting = waiting
    }
    if (answered) {
        set.answered = answered
    }
    if (!waiting || !answered) {
        console.warn("Topic icons missing from Telegram's set", { waiting, answered })
    }
    return set
}

/** The ids of ❓ and ✅ in Telegram's set; none when Telegram cannot say now (no icon then). */
export async function statusIcons(services: Services, token: string): Promise<StatusIcons> {
    let set = iconSets.get(services.telegram)
    if (!set) {
        set = loadIcons(services.telegram, token).catch((error: unknown) => {
            // Asked again with the next message: a passing failure keeps no topic without icons.
            iconSets.delete(services.telegram)
            console.warn("Topic icons not read", String(error))
            return {}
        })
        iconSets.set(services.telegram, set)
    }
    return set
}

/**
 * The topic waits for the shop's answer again (❓, and opened if the shop's people closed it), or
 * got it (✅). Called only when the state changed: a second question changes nothing.
 */
export async function showTopicStatus(
    services: Services,
    token: string,
    topic: Pick<TopicRef, "chatId" | "threadId">,
    waiting: boolean,
): Promise<void> {
    const icons = await statusIcons(services, token)
    const icon = waiting ? icons.waiting : icons.answered
    try {
        if (icon) {
            await services.telegram.editForumTopic(token, topic.chatId, topic.threadId, {
                iconCustomEmojiId: icon,
            })
        }
        if (waiting) {
            await services.telegram.reopenForumTopic(token, topic.chatId, topic.threadId)
        }
    } catch (error) {
        // The icon is a hint: the message itself still goes (a deleted topic is made anew there).
        if (!(error instanceof TelegramApiError)) {
            throw error
        }
        console.warn("Topic status not shown", error.description)
    }
}

/** A group's own words are Uzbek: the shop's people read them. */
export function groupTexts(business: Business): BotTexts {
    return textsFor(Language.UZ, business.type)
}

function orderLine(template: string, order: SupportOrderFacts, t: BotTexts): string {
    return fill(template, {
        n: order.number,
        sum: formatMoney(order.total, Language.UZ),
        status: t.statusNames[order.status],
    })
}

export { orderLine as supportOrderLine }

/** The topic's name for this customer at this shop: «Ism · telefon». */
export function topicNameOf(
    business: Business,
    person: SupportPerson,
    profile: Pick<SupportProfile, "phone">,
): string {
    return supportTopicName(
        { ...person, ...(profile.phone ? { phone: profile.phone } : {}) },
        groupTexts(business).supportTopicName,
    )
}

/** The pinned card: who the customer is, the phone they gave this shop, their orders here. */
export function topicCardText(
    business: Business,
    person: SupportPerson,
    profile: SupportProfile,
): string {
    const g = groupTexts(business)
    const name =
        [person.firstName, person.lastName].filter((part) => part?.trim()).join(" ") ||
        g.supportTopicName
    const orders =
        profile.orders === 0
            ? g.supportNewCustomer
            : fill(g.supportOrders, {
                  n: profile.orders > ORDERS_SHOWN ? `${ORDERS_SHOWN}+` : profile.orders,
              })
    return [
        `👤 <b>${escapeHtml(name)}</b>${person.username ? ` · @${escapeHtml(person.username)}` : ""}`,
        profile.phone ? fill(g.supportPhone, { phone: formatPhone(profile.phone) }) : null,
        orders,
        profile.lastOrder ? orderLine(g.supportLastOrder, profile.lastOrder, g) : null,
        g.supportReplyHint,
    ]
        .filter((line): line is string => line !== null)
        .join("\n")
}

/** A new card at the top of the topic: sent without a sound and pinned there. */
export async function postTopicCard(
    services: Services,
    token: string,
    topic: TopicRef,
    text: string,
): Promise<void> {
    const sent = await services.telegram.sendMessage(token, topic.chatId, text, {
        threadId: topic.threadId,
        silent: true,
    })
    await services.supportThreads.saveCard(topic.chatId, topic.customerTelegramId, sent.messageId)
    try {
        await services.telegram.pinMessage(token, topic.chatId, sent.messageId)
    } catch (error) {
        // The card is there all the same; the owner may pin it by hand.
        if (!(error instanceof TelegramApiError)) {
            throw error
        }
        console.warn("Topic card not pinned", error.description)
    }
}

/** The card written again in place (the topic keeps its place); a deleted one comes anew. */
async function refreshTopicCard(
    services: Services,
    token: string,
    topic: TopicRef & { cardMessageId?: number },
    text: string,
): Promise<void> {
    if (topic.cardMessageId !== undefined) {
        try {
            await services.telegram.editMessage(token, topic.chatId, topic.cardMessageId, text)
            return
        } catch (error) {
            const said = error instanceof TelegramApiError ? error.description : ""
            if (NOT_MODIFIED.test(said)) {
                return
            }
            if (!MESSAGE_GONE.test(said)) {
                throw error
            }
        }
    }
    await postTopicCard(services, token, topic, text)
}

/** Renamed only when the name would change (each rename leaves a line in the topic). */
async function renameTopic(
    services: Services,
    token: string,
    thread: SupportThread,
    name: string,
): Promise<void> {
    if (thread.topicName === name) {
        return
    }
    await services.telegram.editForumTopic(token, thread.chatId, thread.threadId, { name })
    await services.supportThreads.saveName(thread.chatId, thread.customerTelegramId, name)
}

function topicGone(error: unknown): boolean {
    return error instanceof TelegramApiError && TOPIC_GONE.test(error.description)
}

/**
 * A customer who has a topic placed an order (owner's decision, November 2026): a quiet line in
 * their topic, the pinned card written again, and the name with the phone they gave now. A shop
 * without a support group, or a customer without a topic, costs one or two reads and nothing else.
 */
export async function supportOrderPlaced(
    services: Services,
    business: Business,
    order: OrderDTO,
    person: SupportPerson & { telegramId: number },
): Promise<void> {
    const found = await services.useCases.supportTopicOfCustomer.execute({
        businessId: business.id,
        customerTelegramId: person.telegramId,
    })
    const credentials = found ? await services.businesses.getBotCredentials(business.id) : null
    if (!found || !credentials) {
        return
    }
    const { thread } = found
    const token = credentials.token
    const g = groupTexts(business)
    const profile = await services.useCases.supportContext.profile(business.id, person.telegramId)
    try {
        await services.telegram.sendMessage(
            token,
            thread.chatId,
            fill(g.supportOrderLine, {
                n: order.number,
                sum: formatMoney(order.total, Language.UZ),
                method: g.csv.method[order.payment.method],
            }),
            { threadId: thread.threadId, silent: true },
        )
        const topic = {
            chatId: thread.chatId,
            threadId: thread.threadId,
            customerTelegramId: thread.customerTelegramId,
            ...(thread.cardMessageId === undefined ? {} : { cardMessageId: thread.cardMessageId }),
        }
        await refreshTopicCard(services, token, topic, topicCardText(business, person, profile))
        await renameTopic(services, token, thread, topicNameOf(business, person, profile))
    } catch (error) {
        // The shop's people deleted the topic: the customer's next message makes a new one.
        if (!topicGone(error)) {
            throw error
        }
    }
}
