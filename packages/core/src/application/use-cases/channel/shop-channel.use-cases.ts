import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ShopChannel } from "../../../domain/value-objects/shop-channel.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { Business } from "../../../domain/entities/business.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { ShopChannelRepository } from "../../ports/source-links.js"

/** A demo shop and a shop not open yet promote nothing: their orders are not real or not taken. */
export function requirePromotable(business: Business): void {
    if (business.isDemo()) {
        throw BusinessRuleViolationError.demoNotPromoted(business.id)
    }
    if (!business.isActive()) {
        throw BusinessRuleViolationError.shopNotActive(business.id)
    }
}

export interface ChannelDeps {
    businesses: BusinessRepository
    channels: ShopChannelRepository
}

/** Telegram says the shop's bot became an admin who may post, in a channel someone picked. */
export interface BotMadeChannelAdmin {
    businessId: string
    /** Who did it: only the owner connects the shop's channel. */
    actorTelegramId: number
    chatId: number
    title: string
    username?: string
    now: Date
}

export type ConnectOutcome =
    | { kind: "connected"; channel: ShopChannel; replaced?: ShopChannel }
    | { kind: "unchanged"; channel: ShopChannel }
    | { kind: "refused"; why: "notOwner" | "demo" }

/**
 * The shop's channel, connected from Telegram's own screen (`?startchannel`). One per shop: a new
 * one replaces the one before (the Worker then leaves the old one). Someone who is not the owner,
 * or a demo shop, is refused (the Worker leaves that channel and tells the owner).
 */
export class ConnectShopChannelUseCase {
    constructor(private readonly deps: ChannelDeps) {}

    async execute(input: BotMadeChannelAdmin): Promise<ConnectOutcome> {
        const business = await requireBusiness(this.deps.businesses, input.businessId)
        if (!business.isOwnedBy(input.actorTelegramId)) {
            return { kind: "refused", why: "notOwner" }
        }
        if (business.isDemo()) {
            return { kind: "refused", why: "demo" }
        }
        const channel = ShopChannel.connect({
            businessId: business.id,
            chatId: input.chatId,
            title: input.title,
            ...(input.username === undefined ? {} : { username: input.username }),
            connectedAt: input.now,
        })
        const before = await this.deps.channels.find(business.id)
        if (before?.isSameChat(channel.chatId)) {
            // The same channel again (a new title, or its rights given back): no news for the owner.
            const kept = ShopChannel.connect({
                businessId: business.id,
                chatId: channel.chatId,
                title: channel.title,
                ...(channel.username === undefined ? {} : { username: channel.username }),
                connectedAt: before.connectedAt,
            })
            await this.deps.channels.save(kept)
            return { kind: "unchanged", channel: kept }
        }
        await this.deps.channels.save(channel)
        return { kind: "connected", channel, ...(before ? { replaced: before } : {}) }
    }
}

/**
 * The bot was removed from the channel or may no longer post there. News about another chat (one
 * it left before) changes nothing: returns null.
 */
export class LoseShopChannelUseCase {
    constructor(private readonly channels: ShopChannelRepository) {}

    async execute(input: { businessId: string; chatId: number }): Promise<ShopChannel | null> {
        const channel = await this.channels.find(input.businessId)
        if (!channel?.isSameChat(input.chatId)) {
            return null
        }
        await this.channels.remove(input.businessId)
        return channel
    }
}

/** «Kanalni uzish»: Zumda forgets the channel (the Worker then has the bot leave it). */
export class DisconnectShopChannelUseCase {
    constructor(private readonly deps: ChannelDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
    }): Promise<ShopChannel | null> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        const channel = await this.deps.channels.find(input.businessId)
        if (channel) {
            await this.deps.channels.remove(input.businessId)
        }
        return channel
    }
}

export class GetShopChannelUseCase {
    constructor(private readonly deps: ChannelDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
    }): Promise<ShopChannel | null> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        return this.deps.channels.find(input.businessId)
    }
}
