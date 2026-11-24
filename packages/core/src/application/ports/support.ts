import type {
    SupportGroup,
    SupportRefusal,
    SupportThread,
} from "../../domain/value-objects/support-group.js"

export interface SupportGroupRepository {
    find(businessId: string): Promise<SupportGroup | null>
    /** Connects it, replacing the one before. */
    save(group: SupportGroup): Promise<void>
    remove(businessId: string): Promise<void>
}

export interface SupportThreadRepository {
    /** The customer's topic in this group. */
    findByCustomer(chatId: number, customerTelegramId: number): Promise<SupportThread | null>
    /** Whose topic this is. */
    findByThread(chatId: number, threadId: number): Promise<SupportThread | null>
    /** False when the customer has a topic in this group already (two messages at once). */
    insert(thread: SupportThread): Promise<boolean>
    /** A new topic instead of one deleted in Telegram. */
    replace(thread: SupportThread): Promise<void>
    /** The customer asked: true only when the topic was not waiting before (its ❓ to show). */
    markWaiting(chatId: number, customerTelegramId: number, at: Date): Promise<boolean>
    /** The shop answered: true only when the topic was waiting (its ✅ to show). */
    markAnswered(chatId: number, threadId: number): Promise<boolean>
    /** The pinned card of the topic. */
    saveCard(chatId: number, customerTelegramId: number, messageId: number): Promise<void>
    /** The topic's name now. */
    saveName(chatId: number, customerTelegramId: number, name: string): Promise<void>
}

/** The last time connecting the shop's group failed, or the group was lost: the app says why. */
export interface SupportRefusalRepository {
    find(businessId: string): Promise<SupportRefusal | null>
    save(refusal: SupportRefusal): Promise<void>
    clear(businessId: string): Promise<void>
}

/** `noRights`: the bot may not make topics there any more (removed, or the right taken). */
export type TopicOutcome = { kind: "opened"; threadId: number } | { kind: "noRights" }

/** The shop's support group as Telegram sees it (the Worker). A passing failure throws. */
export interface SupportTopics {
    /** A new topic, waiting for the shop's answer from the start (its ❓). */
    open(group: SupportGroup, name: string): Promise<TopicOutcome>
    /** A topic made twice for one customer (two messages at once): the spare one goes. */
    discard(group: SupportGroup, threadId: number): Promise<void>
}
