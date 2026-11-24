import { SupportGroup } from "../../../domain/value-objects/support-group.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { OrderStatus } from "../../../domain/enums/order-status.js"
import type { SupportThread } from "../../../domain/value-objects/support-group.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"
import type { ProductRepository } from "../../ports/product-repository.js"
import type {
    SupportGroupRepository,
    SupportThreadRepository,
    SupportTopics,
} from "../../ports/support.js"

export interface SupportGroupDeps {
    businesses: BusinessRepository
    supportGroups: SupportGroupRepository
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

export type SupportRefusal = "notOwner" | "demo" | "notForum" | "noTopics"

export type SupportConnectOutcome =
    | { kind: "connected"; group: SupportGroup; replaced?: SupportGroup }
    | { kind: "unchanged"; group: SupportGroup }
    | { kind: "lost"; group: SupportGroup }
    | { kind: "refused"; why: SupportRefusal }

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
        if (before?.isSameChat(input.chatId)) {
            // The connected group again: a co-admin changed the bot's rights, or its title.
            if (!usable) {
                await this.deps.supportGroups.remove(business.id)
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
            return { kind: "refused", why: refusal }
        }
        const group = SupportGroup.connect({
            businessId: business.id,
            chatId: input.chatId,
            title: input.title,
            connectedAt: input.now,
        })
        await this.deps.supportGroups.save(group)
        return { kind: "connected", group, ...(before ? { replaced: before } : {}) }
    }
}

function refusalOf(
    input: BotMadeGroupAdmin,
    shop: { owner: boolean; demo: boolean },
): SupportRefusal | null {
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
    constructor(private readonly supportGroups: SupportGroupRepository) {}

    async execute(input: { businessId: string; chatId: number }): Promise<SupportGroup | null> {
        const group = await this.supportGroups.find(input.businessId)
        if (!group?.isSameChat(input.chatId)) {
            return null
        }
        await this.supportGroups.remove(input.businessId)
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

export class GetSupportGroupUseCase {
    constructor(private readonly deps: SupportGroupDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
    }): Promise<SupportGroup | null> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        return this.deps.supportGroups.find(input.businessId)
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
 * customer's topic, made for them on their first message (`created`).
 */
export type SupportRoute =
    | { kind: "none" }
    | { kind: "lost"; group: SupportGroup }
    | { kind: "thread"; group: SupportGroup; threadId: number; created: boolean }

/** A customer wrote to the shop's bot: their own topic in the shop's support group. */
export class OpenSupportThreadUseCase {
    constructor(private readonly deps: SupportThreadDeps) {}

    async execute(input: {
        businessId: string
        customerTelegramId: number
        /** The topic's name: what the customer is called in Telegram. */
        name: string
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
            return { kind: "thread", group, threadId: known.threadId, created: false }
        }
        const opened = await this.deps.topics.open(group, input.name)
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
        }
        if (known) {
            await this.deps.supportThreads.replace(thread)
            return { kind: "thread", group, threadId: opened.threadId, created: true }
        }
        if (await this.deps.supportThreads.insert(thread)) {
            return { kind: "thread", group, threadId: opened.threadId, created: true }
        }
        // Two messages at once made two topics: the first one written wins.
        await this.deps.topics.discard(group, opened.threadId)
        const first = await this.deps.supportThreads.findByCustomer(
            group.chatId,
            input.customerTelegramId,
        )
        return first
            ? { kind: "thread", group, threadId: first.threadId, created: false }
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
}

/**
 * What the shop's people see about a customer: their last order at this shop, and what
 * «Do'konga yozish» was pressed on. Someone else's order, or another shop's product, is never
 * told (a link can be typed by hand).
 */
export class SupportContextUseCase {
    constructor(private readonly deps: SupportContextDeps) {}

    /** The customer's newest order at this shop, if any. */
    async lastOrder(
        businessId: string,
        customerTelegramId: number,
    ): Promise<SupportOrderFacts | null> {
        const customer = await this.deps.customers.findByTelegramId(customerTelegramId)
        if (!customer) {
            return null
        }
        const page = await this.deps.orders.listByCustomer(customer.id, businessId, {
            page: 1,
            limit: 1,
        })
        const order = page.data[0]
        return order
            ? {
                  orderId: order.id,
                  number: order.number,
                  total: order.total.amount,
                  status: order.status,
              }
            : null
    }

    async about(input: {
        businessId: string
        customerTelegramId: number
        orderId?: string
        productId?: string
    }): Promise<SupportAbout | null> {
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
