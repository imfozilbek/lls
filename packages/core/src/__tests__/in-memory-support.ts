import type {
    SupportGroupRepository,
    SupportRefusalRepository,
    SupportThreadRepository,
    SupportTopics,
    TopicOutcome,
} from "../application/ports/support.js"
import type {
    SupportGroup,
    SupportRefusal,
    SupportThread,
} from "../domain/value-objects/support-group.js"

export class InMemorySupportGroups implements SupportGroupRepository {
    readonly items = new Map<string, SupportGroup>()

    async find(businessId: string): Promise<SupportGroup | null> {
        return this.items.get(businessId) ?? null
    }
    async save(group: SupportGroup): Promise<void> {
        this.items.set(group.businessId, group)
    }
    async remove(businessId: string): Promise<void> {
        this.items.delete(businessId)
    }
}

export class InMemorySupportThreads implements SupportThreadRepository {
    readonly items: SupportThread[] = []
    /** Another message of the same customer wrote its topic first. */
    beatenBy: SupportThread | undefined

    async findByCustomer(chatId: number, customer: number): Promise<SupportThread | null> {
        return (
            this.items.find((t) => t.chatId === chatId && t.customerTelegramId === customer) ?? null
        )
    }
    async findByThread(chatId: number, threadId: number): Promise<SupportThread | null> {
        return this.items.find((t) => t.chatId === chatId && t.threadId === threadId) ?? null
    }
    async insert(thread: SupportThread): Promise<boolean> {
        if (this.beatenBy) {
            this.items.push(this.beatenBy)
            this.beatenBy = undefined
        }
        if (await this.findByCustomer(thread.chatId, thread.customerTelegramId)) {
            return false
        }
        this.items.push({ ...thread })
        return true
    }
    async replace(thread: SupportThread): Promise<void> {
        const at = this.items.findIndex(
            (t) => t.chatId === thread.chatId && t.customerTelegramId === thread.customerTelegramId,
        )
        this.items.splice(at, 1, { ...thread })
    }
    private byCustomer(chatId: number, customer: number): SupportThread | undefined {
        return this.items.find((t) => t.chatId === chatId && t.customerTelegramId === customer)
    }
    async markWaiting(chatId: number, customer: number, at: Date): Promise<boolean> {
        const thread = this.byCustomer(chatId, customer)
        if (!thread || thread.waitingSince) {
            return false
        }
        thread.waitingSince = at
        return true
    }
    async markAnswered(chatId: number, threadId: number): Promise<boolean> {
        const thread = this.items.find((t) => t.chatId === chatId && t.threadId === threadId)
        if (!thread?.waitingSince) {
            return false
        }
        delete thread.waitingSince
        return true
    }
    async saveCard(chatId: number, customer: number, messageId: number): Promise<void> {
        const thread = this.byCustomer(chatId, customer)
        if (thread) {
            thread.cardMessageId = messageId
        }
    }
    async saveName(chatId: number, customer: number, name: string): Promise<void> {
        const thread = this.byCustomer(chatId, customer)
        if (thread) {
            thread.topicName = name
        }
    }
}

export class InMemorySupportRefusals implements SupportRefusalRepository {
    readonly items = new Map<string, SupportRefusal>()

    async find(businessId: string): Promise<SupportRefusal | null> {
        return this.items.get(businessId) ?? null
    }
    async save(refusal: SupportRefusal): Promise<void> {
        this.items.set(refusal.businessId, { ...refusal })
    }
    async clear(businessId: string): Promise<void> {
        this.items.delete(businessId)
    }
}

export class FakeSupportTopics implements SupportTopics {
    readonly opened: { chatId: number; name: string; threadId: number }[] = []
    readonly discarded: number[] = []
    noRights = false
    private next = 100

    async open(group: SupportGroup, name: string): Promise<TopicOutcome> {
        if (this.noRights) {
            return { kind: "noRights" }
        }
        const threadId = this.next++
        this.opened.push({ chatId: group.chatId, name, threadId })
        return { kind: "opened", threadId }
    }
    async discard(_group: SupportGroup, threadId: number): Promise<void> {
        this.discarded.push(threadId)
    }
}
