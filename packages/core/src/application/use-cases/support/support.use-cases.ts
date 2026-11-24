import { SupportGroup } from "../../../domain/value-objects/support-group.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { OrderStatus } from "../../../domain/enums/order-status.js"
import type {
    SupportRefusal,
    SupportRefusalReason,
    SupportThread,
} from "../../../domain/value-objects/support-group.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"
import type { ProductRepository } from "../../ports/product-repository.js"
import type { SourceLinkRepository } from "../../ports/source-links.js"
import type {
    SupportGroupRepository,
    SupportRefusalRepository,
    SupportThreadRepository,
    SupportTopics,
} from "../../ports/support.js"

export interface SupportGroupDeps {
    businesses: BusinessRepository
    supportGroups: SupportGroupRepository
    /** Why the last connecting failed, or the group was lost: the app says it. */
    supportRefusals: SupportRefusalRepository
}

/** Telegram says the shop's bot became an admin of a group someone picked (`?startgroup`). */
export interface BotMadeGroupAdmin {
    businessId: string
    /** Who did it: only the owner connects the shop's support group. */
    actorTelegramId: number
    chatId: number
    title: string
    /** The group has topics: one a customer. */
    isForum: boolean
    /** The bot may make topics there. */
    canManageTopics: boolean
    now: Date
}

export type SupportConnectRefusal = Exclude<SupportRefusalReason, "lost">

export type SupportConnectOutcome =
    | { kind: "connected"; group: SupportGroup; replaced?: SupportGroup }
    | { kind: "unchanged"; group: SupportGroup }
    | { kind: "lost"; group: SupportGroup }
    | { kind: "refused"; why: SupportConnectRefusal }

/**
 * The shop's support group, connected from Telegram's own screen (`?startgroup`). One per shop:
 * a new one replaces the one before (the Worker then leaves the old one). Someone who is not the
 * owner, a demo shop, a group without topics or a bot that may not make them is refused (the
 * Worker leaves that group and tells the owner why).
 */
export class ConnectSupportGroupUseCase {
    constructor(private readonly deps: SupportGroupDeps) {}

    async execute(input: BotMadeGroupAdmin): Promise<SupportConnectOutcome> {
        const business = await requireBusiness(this.deps.businesses, input.businessId)
        const before = await this.deps.supportGroups.find(business.id)
        const usable = input.isForum && input.canManageTopics
        const refuse = (reason: SupportRefusalReason, title: string): Promise<void> =>
            this.deps.supportRefusals.save({
                businessId: business.id,
                reason,
                title,
                at: input.now,
            })
        if (before?.isSameChat(input.chatId)) {
            // The connected group again: a co-admin changed the bot's rights, or its title.
            if (!usable) {
                await this.deps.supportGroups.remove(business.id)
                await refuse("lost", before.title)
                return { kind: "lost", group: before }
            }
            const kept = before.renamed(input.title)
            await this.deps.supportGroups.save(kept)
            return { kind: "unchanged", group: kept }
        }
        const refusal = refusalOf(input, {
            owner: business.isOwnedBy(input.actorTelegramId),
            demo: business.isDemo(),
        })
        if (refusal) {
            await refuse(refusal, input.title)
            return { kind: "refused", why: refusal }
        }
        const group = SupportGroup.connect({
            businessId: business.id,
            chatId: input.chatId,
            title: input.title,
            connectedAt: input.now,
        })
        await this.deps.supportGroups.save(group)
        await this.deps.supportRefusals.clear(business.id)
        return { kind: "connected", group, ...(before ? { replaced: before } : {}) }
    }
}

function refusalOf(
    input: BotMadeGroupAdmin,
    shop: { owner: boolean; demo: boolean },
): SupportConnectRefusal | null {
    if (!shop.owner) {
        return "notOwner"
    }
    if (shop.demo) {
        return "demo"
    }
    if (!input.isForum) {
        return "notForum"
    }
    return input.canManageTopics ? null : "noTopics"
}

/**
 * The bot was removed from the group. News about another chat (one it left before) changes
 * nothing: returns null.
 */
export class LoseSupportGroupUseCase {
    constructor(private readonly deps: Omit<SupportGroupDeps, "businesses">) {}

    async execute(input: {
        businessId: string
        chatId: number
        now: Date
    }): Promise<SupportGroup | null> {
        const group = await this.deps.supportGroups.find(input.businessId)
        if (!group?.isSameChat(input.chatId)) {
            return null
        }
        await this.deps.supportGroups.remove(input.businessId)
        await this.deps.supportRefusals.save({
            businessId: input.businessId,
            reason: "lost",
            title: group.title,
            at: input.now,
        })
        return group
    }
}

/** «Guruhni ajratish»: Zumda forgets the group (the Worker then has the bot leave it). */
export class DisconnectSupportGroupUseCase {
    constructor(private readonly deps: SupportGroupDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
    }): Promise<SupportGroup | null> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        const group = await this.deps.supportGroups.find(input.businessId)
        if (group) {
            await this.deps.supportGroups.remove(input.businessId)
        }
        return group
    }
}

/** The owner's view: the group connected now, and why the last try failed (if it did). */
export interface SupportGroupState {
    group: SupportGroup | null
    refusal: SupportRefusal | null
}

export class GetSupportGroupUseCase {
    constructor(private readonly deps: SupportGroupDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
    }): Promise<SupportGroupState> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        const group = await this.deps.supportGroups.find(input.businessId)
        // A group connected now: an older refusal says nothing any more.
        const refusal = group ? null : await this.deps.supportRefusals.find(input.businessId)
        return { group, refusal }
    }
}

export interface SupportThreadDeps {
    supportGroups: SupportGroupRepository
    supportThreads: SupportThreadRepository
    topics: SupportTopics
}

/**
 * Where a customer's message goes: `none` (the shop has no support group: the bot answers as
 * before), `lost` (the bot may not make topics there any more: the group is forgotten), or the
 * customer's topic, made for them on their first message (`created`); `nowWaiting`: an answered
 * topic waits again (its ❓ to show); `unnamed`: a topic made before its name and card were kept
 * (goal 22), to be named and given its card once.
 */
export type SupportRoute =
    | { kind: "none" }
    | { kind: "lost"; group: SupportGroup }
    | {
          kind: "thread"
          group: SupportGroup
          threadId: number
          created: boolean
          nowWaiting: boolean
          unnamed: boolean
      }

/** A customer wrote to the shop's bot: their own topic in the shop's support group. */
export class OpenSupportThreadUseCase {
    constructor(private readonly deps: SupportThreadDeps) {}

    async execute(input: {
        businessId: string
        customerTelegramId: number
        /**
         * The topic's name («Ism · telefon»): asked for only when a topic is made, since the
         * phone given to this shop costs reads every other message would not need.
         */
        nameOf: () => Promise<string>
        /** Their topic was deleted in Telegram: a new one takes its place. */
        staleThreadId?: number
        now: Date
    }): Promise<SupportRoute> {
        const group = await this.deps.supportGroups.find(input.businessId)
        if (!group) {
            return { kind: "none" }
        }
        const known = await this.deps.supportThreads.findByCustomer(
            group.chatId,
            input.customerTelegramId,
        )
        if (known && known.threadId !== input.staleThreadId) {
            const nowWaiting = await this.deps.supportThreads.markWaiting(
                group.chatId,
                input.customerTelegramId,
                input.now,
            )
            return {
                kind: "thread",
                group,
                threadId: known.threadId,
                created: false,
                nowWaiting,
                unnamed: known.topicName === undefined,
            }
        }
        const name = await input.nameOf()
        const opened = await this.deps.topics.open(group, name)
        if (opened.kind === "noRights") {
            await this.deps.supportGroups.remove(group.businessId)
            return { kind: "lost", group }
        }
        const thread: SupportThread = {
            businessId: group.businessId,
            chatId: group.chatId,
            customerTelegramId: input.customerTelegramId,
            threadId: opened.threadId,
            createdAt: input.now,
            waitingSince: input.now,
            topicName: name,
        }
        const made = {
            kind: "thread",
            group,
            threadId: opened.threadId,
            created: true,
            nowWaiting: false,
            unnamed: false,
        } as const
        if (known) {
            await this.deps.supportThreads.replace(thread)
            return made
        }
        if (await this.deps.supportThreads.insert(thread)) {
            return made
        }
        // Two messages at once made two topics: the first one written wins.
        await this.deps.topics.discard(group, opened.threadId)
        const first = await this.deps.supportThreads.findByCustomer(
            group.chatId,
            input.customerTelegramId,
        )
        return first
            ? {
                  kind: "thread",
                  group,
                  threadId: first.threadId,
                  created: false,
                  nowWaiting: false,
                  unnamed: false,
              }
            : { kind: "none" }
    }
}

/**
 * Someone of the shop wrote in a topic of the shop's support group: the customer it goes to, or
 * null (another group, the General topic, a topic Zumda did not make).
 */
export class FindSupportCustomerUseCase {
    constructor(
        private readonly deps: Pick<SupportThreadDeps, "supportGroups" | "supportThreads">,
    ) {}

    async execute(input: {
        businessId: string
        chatId: number
        threadId: number
    }): Promise<number | null> {
        const group = await this.deps.supportGroups.find(input.businessId)
        if (!group?.isSameChat(input.chatId)) {
            return null
        }
        const thread = await this.deps.supportThreads.findByThread(input.chatId, input.threadId)
        return thread?.customerTelegramId ?? null
    }
}

/**
 * Someone of the shop answered in a customer's topic: true only when the topic was waiting (its
 * ✅ to show); a second answer, or an answer in a topic nobody waits in, changes nothing.
 */
export class MarkSupportAnsweredUseCase {
    constructor(
        private readonly deps: Pick<SupportThreadDeps, "supportGroups" | "supportThreads">,
    ) {}

    async execute(input: {
        businessId: string
        chatId: number
        threadId: number
    }): Promise<boolean> {
        const group = await this.deps.supportGroups.find(input.businessId)
        if (!group?.isSameChat(input.chatId)) {
            return false
        }
        return this.deps.supportThreads.markAnswered(input.chatId, input.threadId)
    }
}

/** The customer's topic in the shop's support group of now, if they have one. */
export class SupportTopicOfCustomerUseCase {
    constructor(
        private readonly deps: Pick<SupportThreadDeps, "supportGroups" | "supportThreads">,
    ) {}

    async execute(input: {
        businessId: string
        customerTelegramId: number
    }): Promise<{ group: SupportGroup; thread: SupportThread } | null> {
        const group = await this.deps.supportGroups.find(input.businessId)
        if (!group) {
            return null
        }
        const thread = await this.deps.supportThreads.findByCustomer(
            group.chatId,
            input.customerTelegramId,
        )
        return thread ? { group, thread } : null
    }
}

/** «⭐ 10+ ta buyurtma»: the card counts a customer's orders up to this, never the whole history. */
export const SUPPORT_ORDERS_SHOWN = 10

/** One of the customer's orders at this shop, as the shop's people see it in the topic. */
export interface SupportOrderFacts {
    orderId: string
    number: number
    total: number
    status: OrderStatus
}

/** What «Do'konga yozish» is about: an order of this customer, or a product of this shop. */
export type SupportAbout =
    | { kind: "order"; order: SupportOrderFacts }
    | { kind: "product"; productId: string; name: string }

export interface SupportContextDeps {
    customers: CustomerRepository
    orders: OrderRepository
    products: ProductRepository
    links: SourceLinkRepository
}

/** What the topic's pinned card says about the customer at this shop. */
export interface SupportProfile {
    /** The phone they gave THIS shop (E.164); none when they gave it only to another shop. */
    phone?: string
    /** Their orders here that were not cancelled, up to `SUPPORT_ORDERS_SHOWN` + 1 («10+»). */
    orders: number
    lastOrder: SupportOrderFacts | null
}

/**
 * What the shop's people see about a customer: their last order at this shop, and what
 * «Do'konga yozish» was pressed on. Someone else's order, or another shop's product, is never
 * told (a link can be typed by hand).
 */
export class SupportContextUseCase {
    constructor(private readonly deps: SupportContextDeps) {}

    /**
     * The customer at this shop: the phone they gave it, how many orders (counted up to 11, never
     * the history), the newest one.
     */
    async profile(businessId: string, customerTelegramId: number): Promise<SupportProfile> {
        const customer = await this.deps.customers.findByTelegramId(customerTelegramId)
        if (!customer) {
            return { orders: 0, lastOrder: null }
        }
        const [shared, orders, page] = await Promise.all([
            customer.phone
                ? this.deps.customers.hasSharedPhoneWith(customer.id, businessId)
                : Promise.resolve(false),
            this.deps.orders.countByCustomer(customer.id, businessId, SUPPORT_ORDERS_SHOWN + 1),
            this.deps.orders.listByCustomer(customer.id, businessId, { page: 1, limit: 1 }),
        ])
        const order = page.data[0]
        return {
            ...(shared && customer.phone ? { phone: customer.phone.number } : {}),
            orders,
            lastOrder: order
                ? {
                      orderId: order.id,
                      number: order.number,
                      total: order.total.amount,
                      status: order.status,
                  }
                : null,
        }
    }

    async about(input: {
        businessId: string
        customerTelegramId: number
        orderId?: string
        productId?: string
        /** «Savolim bor» under a channel post: about the product the post leads to now. */
        linkId?: string
    }): Promise<SupportAbout | null> {
        if (input.linkId !== undefined) {
            const link = await this.deps.links.findById(input.businessId, input.linkId)
            const productId = link?.isLive ? link.productId : undefined
            return productId === undefined
                ? null
                : this.about({
                      businessId: input.businessId,
                      customerTelegramId: input.customerTelegramId,
                      productId,
                  })
        }
        if (input.orderId !== undefined) {
            const order = await this.deps.orders.findById(input.orderId)
            const customer = await this.deps.customers.findByTelegramId(input.customerTelegramId)
            if (!order || !customer || order.businessId !== input.businessId) {
                return null
            }
            return order.customerId === customer.id
                ? {
                      kind: "order",
                      order: {
                          orderId: order.id,
                          number: order.number,
                          total: order.total.amount,
                          status: order.status,
                      },
                  }
                : null
        }
        if (input.productId !== undefined) {
            const product = await this.deps.products.findById(input.productId)
            return product?.businessId === input.businessId
                ? { kind: "product", productId: product.id, name: product.name }
                : null
        }
        return null
    }
}
