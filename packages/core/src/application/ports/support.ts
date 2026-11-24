import type { SupportGroup, SupportThread } from "../../domain/value-objects/support-group.js"

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
}

/** `noRights`: the bot may not make topics there any more (removed, or the right taken). */
export type TopicOutcome = { kind: "opened"; threadId: number } | { kind: "noRights" }

/** The shop's support group as Telegram sees it (the Worker). A passing failure throws. */
export interface SupportTopics {
    open(group: SupportGroup, name: string): Promise<TopicOutcome>
    /** A topic made twice for one customer (two messages at once): the spare one goes. */
    discard(group: SupportGroup, threadId: number): Promise<void>
}
