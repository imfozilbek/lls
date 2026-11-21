import {
    MAX_AD_LINKS,
    MAX_SYNCED_POSTS,
    SOURCE_VISIT_WINDOW_MS,
    SourceLink,
    SourceLinkKind,
} from "../../../domain/entities/source-link.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { postFactsOf, postKeyOf } from "../../../domain/services/post-facts.js"
import { offsetOf } from "../../dtos/pagination.js"
import { toSourceLinkDTO } from "../../dtos/source-link.dto.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import { requirePromotable } from "./shop-channel.use-cases.js"

import type { Business } from "../../../domain/entities/business.js"
import type { Product } from "../../../domain/entities/product.js"
import type { ShopChannel } from "../../../domain/value-objects/shop-channel.js"
import type { Page, PageRequest } from "../../dtos/pagination.js"
import type { SourceLinkDTO } from "../../dtos/source-link.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { ProductRepository } from "../../ports/product-repository.js"
import type {
    ChannelPublisher,
    ShopChannelRepository,
    SourceLinkRepository,
} from "../../ports/source-links.js"

export interface SourceLinkDeps {
    businesses: BusinessRepository
    products: ProductRepository
    channels: ShopChannelRepository
    links: SourceLinkRepository
}

async function requireShopProduct(
    products: ProductRepository,
    business: Business,
    productId: string,
): Promise<Product> {
    const product = await products.findById(productId)
    if (!product || product.businessId !== business.id) {
        throw EntityNotFoundError.product(productId)
    }
    return product
}

async function requireChannel(
    channels: ShopChannelRepository,
    businessId: string,
): Promise<ShopChannel> {
    const channel = await channels.find(businessId)
    if (!channel) {
        throw BusinessRuleViolationError.channelNotConnected(businessId)
    }
    return channel
}

/**
 * «Kanalga joylash»: the product goes to the shop's channel with «Buyurtma berish» under it. The
 * row is written only once Telegram took the post; a post whose row could not be written is
 * taken back from the channel, so the list never misses a post Zumda made.
 */
export class PublishPostUseCase {
    constructor(private readonly deps: SourceLinkDeps & { publisher: ChannelPublisher }) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        productId: string
        text?: string
        now: Date
    }): Promise<SourceLinkDTO> {
        const { businesses, products, channels, links, publisher } = this.deps
        const business = await requireOwnedBusiness(
            businesses,
            input.businessId,
            input.actorTelegramId,
        )
        requirePromotable(business)
        const channel = await requireChannel(channels, business.id)
        const product = await requireShopProduct(products, business, input.productId)
        if (!product.isAvailableAt(input.now)) {
            throw BusinessRuleViolationError.postProductUnavailable(product.id)
        }
        const facts = postFactsOf(product)
        const link = SourceLink.post({
            businessId: business.id,
            productId: product.id,
            ownerText: input.text,
            postKey: postKeyOf(facts),
            now: input.now,
        })
        const outcome = await publisher.publish(channel, {
            linkId: link.id,
            facts,
            ...(link.ownerText === undefined ? {} : { ownerText: link.ownerText }),
        })
        if (outcome.kind === "noRights") {
            await channels.remove(business.id)
            throw BusinessRuleViolationError.channelNoRights(business.id)
        }
        link.posted(outcome.ref)
        try {
            await links.insert(link)
        } catch (error) {
            await publisher.remove(channel, link).catch(() => "refused")
            throw error
        }
        return toSourceLinkDTO(link, channel)
    }
}

/** «Yangi havola»: a named link for an ad, to the whole shop or to one product. */
export class CreateAdLinkUseCase {
    constructor(private readonly deps: Omit<SourceLinkDeps, "channels">) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        label: string
        productId?: string
        now: Date
    }): Promise<SourceLinkDTO> {
        const { businesses, products, links } = this.deps
        const business = await requireOwnedBusiness(
            businesses,
            input.businessId,
            input.actorTelegramId,
        )
        requirePromotable(business)
        if (input.productId !== undefined) {
            await requireShopProduct(products, business, input.productId)
        }
        if ((await links.countLiveAds(business.id, MAX_AD_LINKS)) >= MAX_AD_LINKS) {
            throw BusinessRuleViolationError.tooManyLinks(MAX_AD_LINKS)
        }
        const link = SourceLink.ad({
            businessId: business.id,
            label: input.label,
            ...(input.productId === undefined ? {} : { productId: input.productId }),
            now: input.now,
        })
        await links.insert(link)
        return toSourceLinkDTO(link)
    }
}

/**
 * The live posts of the channel connected now, or the live ad links, newest first. The total is
 * a lower bound (one row more says whether more follow): no count over the history.
 */
export class ListSourceLinksUseCase {
    constructor(private readonly deps: Omit<SourceLinkDeps, "products">) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        kind: SourceLinkKind
        page: PageRequest
    }): Promise<Page<SourceLinkDTO>> {
        const { businesses, channels, links } = this.deps
        await requireOwnedBusiness(businesses, input.businessId, input.actorTelegramId)
        const channel = await channels.find(input.businessId)
        const meta = { page: input.page.page, limit: input.page.limit }
        if (input.kind === SourceLinkKind.POST && !channel) {
            return { data: [], meta: { ...meta, total: 0 } }
        }
        const offset = offsetOf(input.page)
        const rows = await links.listLive(input.businessId, input.kind, {
            offset,
            limit: input.page.limit + 1,
            ...(input.kind === SourceLinkKind.POST && channel ? { chatId: channel.chatId } : {}),
        })
        const shown = rows.slice(0, input.page.limit)
        const more = rows.length > shown.length ? 1 : 0
        return {
            data: shown.map((link) => toSourceLinkDTO(link, channel)),
            meta: { ...meta, total: offset + shown.length + more },
        }
    }
}

/**
 * «O'chirish»: an ad link stops counting; a post of the channel connected now is deleted there
 * first, and stays (with its row) when Telegram refuses.
 */
export class DeleteSourceLinkUseCase {
    constructor(
        private readonly deps: Omit<SourceLinkDeps, "products"> & {
            publisher: ChannelPublisher
        },
    ) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        linkId: string
        now: Date
    }): Promise<void> {
        const { businesses, channels, links, publisher } = this.deps
        await requireOwnedBusiness(businesses, input.businessId, input.actorTelegramId)
        const link = await links.findById(input.businessId, input.linkId)
        if (!link?.isLive) {
            throw EntityNotFoundError.sourceLink(input.linkId)
        }
        const channel = link.post ? await channels.find(input.businessId) : null
        if (link.post && channel?.isSameChat(link.post.chatId)) {
            if ((await publisher.remove(channel, link)) === "refused") {
                throw BusinessRuleViolationError.postNotDeletable(link.id)
            }
        }
        link.remove(input.now)
        await links.save(link)
    }
}

/**
 * Someone pressed `?start=s_<code>` in the shop's bot: the visit is kept for their next order.
 * The owner's own presses never count. Returns the live link (null for an unknown or removed
 * one: the bot greets as usual).
 */
export class OpenSourceLinkUseCase {
    constructor(private readonly deps: Pick<SourceLinkDeps, "businesses" | "links">) {}

    async execute(input: {
        businessId: string
        code: string
        telegramId: number
        now: Date
    }): Promise<SourceLink | null> {
        if (!SourceLink.isCode(input.code)) {
            return null
        }
        const link = await this.deps.links.findById(input.businessId, input.code)
        if (!link?.isLive) {
            return null
        }
        const business = await requireBusiness(this.deps.businesses, input.businessId)
        if (!business.isOwnedBy(input.telegramId)) {
            await this.deps.links.recordVisit({
                businessId: business.id,
                telegramId: input.telegramId,
                linkId: link.id,
                at: input.now,
            })
        }
        return link
    }
}

/** The link an order came from: the one the customer pressed last, within the window. */
export class FindOrderSourceUseCase {
    constructor(private readonly links: SourceLinkRepository) {}

    async execute(input: {
        businessId: string
        telegramId: number
        now: Date
    }): Promise<string | undefined> {
        const since = new Date(input.now.getTime() - SOURCE_VISIT_WINDOW_MS)
        const linkId = await this.links.lastVisit(input.businessId, input.telegramId, since)
        return linkId ?? undefined
    }
}

/**
 * The product's name, price or age changed: its newest live posts in the channel connected now
 * say it too (the owner's words and the button stay). A post deleted in Telegram leaves the
 * list; rights taken away disconnect the channel. Returns how many posts were edited.
 */
export class SyncProductPostsUseCase {
    constructor(
        private readonly deps: Omit<SourceLinkDeps, "businesses"> & {
            publisher: ChannelPublisher
        },
    ) {}

    async execute(input: { businessId: string; productId: string; now: Date }): Promise<number> {
        const { channels, products, links, publisher } = this.deps
        const channel = await channels.find(input.businessId)
        const product = channel ? await products.findById(input.productId) : null
        if (!channel || product?.businessId !== input.businessId) {
            return 0
        }
        const facts = postFactsOf(product)
        const key = postKeyOf(facts)
        const posts = await links.livePosts(
            input.businessId,
            product.id,
            channel.chatId,
            MAX_SYNCED_POSTS,
        )
        let edited = 0
        for (const post of posts.filter((p) => p.postKey !== key)) {
            const outcome = await publisher.edit(channel, post, facts)
            if (outcome === "noRights") {
                await channels.remove(input.businessId)
                break
            }
            if (outcome === "edited") {
                post.resynced(key)
                edited += 1
            } else {
                post.remove(input.now)
            }
            await links.save(post)
        }
        return edited
    }
}
