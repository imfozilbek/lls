import { SourceLink, SourceLinkKind } from "../domain/entities/source-link.js"

import type {
    ChannelPost,
    ChannelPublisher,
    EditOutcome,
    PublishOutcome,
    RemoveOutcome,
    ShopChannelRepository,
    SourceLinkRepository,
    SourceVisit,
} from "../application/ports/source-links.js"
import type { SourceLinkProps } from "../domain/entities/source-link.js"
import type { PostFacts } from "../domain/services/post-facts.js"
import type { ShopChannel } from "../domain/value-objects/shop-channel.js"

function propsOf(link: SourceLink): SourceLinkProps {
    return {
        id: link.id,
        businessId: link.businessId,
        kind: link.kind,
        productId: link.productId,
        label: link.label,
        post: link.post ? { ...link.post } : undefined,
        ownerText: link.ownerText,
        postKey: link.postKey,
        counts: link.counts,
        createdAt: link.createdAt,
        deletedAt: link.deletedAt,
    }
}

export class InMemoryShopChannels implements ShopChannelRepository {
    readonly items = new Map<string, ShopChannel>()

    async find(businessId: string): Promise<ShopChannel | null> {
        return this.items.get(businessId) ?? null
    }
    async save(channel: ShopChannel): Promise<void> {
        this.items.set(channel.businessId, channel)
    }
    async remove(businessId: string): Promise<void> {
        this.items.delete(businessId)
    }
}

/** Keeps copies, as D1 would: a link changed in memory is not saved until `save`. */
export class InMemorySourceLinks implements SourceLinkRepository {
    readonly items = new Map<string, SourceLink>()
    readonly visits = new Map<string, SourceVisit>()
    failInsert = false

    private copy(link: SourceLink): SourceLink {
        return SourceLink.restore(propsOf(link))
    }

    async findById(businessId: string, id: string): Promise<SourceLink | null> {
        const link = this.items.get(id)
        return link?.businessId === businessId ? this.copy(link) : null
    }
    async insert(link: SourceLink): Promise<void> {
        if (this.failInsert) {
            throw new Error("D1 is down")
        }
        this.items.set(link.id, this.copy(link))
    }
    async save(link: SourceLink): Promise<void> {
        this.items.set(link.id, this.copy(link))
    }
    private live(businessId: string, kind: SourceLinkKind): SourceLink[] {
        return [...this.items.values()]
            .filter((l) => l.businessId === businessId && l.kind === kind && l.isLive)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    async listLive(
        businessId: string,
        kind: SourceLinkKind,
        page: { offset: number; limit: number; chatId?: number },
    ): Promise<SourceLink[]> {
        return this.live(businessId, kind)
            .filter((l) => page.chatId === undefined || l.post?.chatId === page.chatId)
            .slice(page.offset, page.offset + page.limit)
            .map((l) => this.copy(l))
    }
    async countLiveAds(businessId: string, atMost: number): Promise<number> {
        return Math.min(this.live(businessId, SourceLinkKind.AD).length, atMost)
    }
    async livePosts(
        businessId: string,
        productId: string,
        chatId: number,
        limit: number,
    ): Promise<SourceLink[]> {
        return this.live(businessId, SourceLinkKind.POST)
            .filter((l) => l.productId === productId && l.post?.chatId === chatId)
            .slice(0, limit)
            .map((l) => this.copy(l))
    }
    async recordVisit(visit: SourceVisit): Promise<void> {
        const key = `${visit.businessId}:${visit.telegramId}`
        const before = this.visits.get(key)
        this.visits.set(key, { ...visit })
        const link = this.items.get(visit.linkId)
        if (link && before?.linkId !== visit.linkId) {
            const counts = link.counts
            this.items.set(
                link.id,
                SourceLink.restore({
                    ...propsOf(link),
                    counts: { ...counts, opens: counts.opens + 1 },
                }),
            )
        }
    }
    async lastVisit(businessId: string, telegramId: number, since: Date): Promise<string | null> {
        const visit = this.visits.get(`${businessId}:${telegramId}`)
        return visit && visit.at.getTime() >= since.getTime() ? visit.linkId : null
    }
}

/** A channel that takes everything; `refuse` and `gone` make Telegram say no. */
export class FakeChannelPublisher implements ChannelPublisher {
    readonly published: ChannelPost[] = []
    readonly edited: { linkId: string; facts: PostFacts }[] = []
    readonly removed: string[] = []
    publishAnswer: "posted" | "noRights" | "fail" = "posted"
    editAnswer: EditOutcome = "edited"
    removeAnswer: RemoveOutcome = "removed"
    private nextMessageId = 500

    async publish(channel: ShopChannel, post: ChannelPost): Promise<PublishOutcome> {
        if (this.publishAnswer === "fail") {
            throw new Error("Telegram is down")
        }
        if (this.publishAnswer === "noRights") {
            return { kind: "noRights" }
        }
        this.published.push(post)
        return {
            kind: "posted",
            ref: { chatId: channel.chatId, messageId: this.nextMessageId++, photoFileId: "AgAD" },
        }
    }
    async edit(_channel: ShopChannel, link: SourceLink, facts: PostFacts): Promise<EditOutcome> {
        if (this.editAnswer === "edited") {
            this.edited.push({ linkId: link.id, facts })
        }
        return this.editAnswer
    }
    async remove(_channel: ShopChannel, link: SourceLink): Promise<RemoveOutcome> {
        if (this.removeAnswer === "removed") {
            this.removed.push(link.id)
        }
        return this.removeAnswer
    }
}
