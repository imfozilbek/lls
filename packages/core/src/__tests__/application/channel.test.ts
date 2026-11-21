import { beforeEach, describe, expect, it } from "vitest"

import {
    ConnectShopChannelUseCase,
    DisconnectShopChannelUseCase,
    LoseShopChannelUseCase,
} from "../../application/use-cases/channel/shop-channel.use-cases.js"
import {
    CreateAdLinkUseCase,
    DeleteSourceLinkUseCase,
    FindOrderSourceUseCase,
    ListSourceLinksUseCase,
    OpenSourceLinkUseCase,
    PublishPostUseCase,
    SyncProductPostsUseCase,
} from "../../application/use-cases/channel/source-links.use-cases.js"
import {
    MAX_AD_LINKS,
    MAX_SYNCED_POSTS,
    SOURCE_VISIT_WINDOW_MS,
    SourceLinkKind,
} from "../../domain/entities/source-link.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { CUSTOMER_TG, OWNER_TG, STRANGER_TG, makeBusiness, makeProduct } from "../fixtures.js"
import { InMemoryBusinesses, InMemoryProducts } from "../in-memory.js"
import {
    FakeChannelPublisher,
    InMemoryShopChannels,
    InMemorySourceLinks,
} from "../in-memory-channel.js"

import type { Business } from "../../domain/entities/business.js"

const NOW = new Date("2026-11-21T09:00:00Z")
const CHAT = -1001234567890

function rule(code: string): (error: unknown) => boolean {
    return (error) => error instanceof BusinessRuleViolationError && error.rule === code
}

describe("the shop's channel and its links", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let channels: InMemoryShopChannels
    let links: InMemorySourceLinks
    let publisher: FakeChannelPublisher
    let shop: Business

    const deps = (): {
        businesses: InMemoryBusinesses
        products: InMemoryProducts
        channels: InMemoryShopChannels
        links: InMemorySourceLinks
        publisher: FakeChannelPublisher
    } => ({ businesses, products, channels, links, publisher })

    const connect = (
        input: Partial<{ actor: number; chatId: number; title: string }> = {},
    ): ReturnType<ConnectShopChannelUseCase["execute"]> =>
        new ConnectShopChannelUseCase(deps()).execute({
            businessId: shop.id,
            actorTelegramId: input.actor ?? OWNER_TG,
            chatId: input.chatId ?? CHAT,
            title: input.title ?? "ABC",
            now: NOW,
        })

    const publish = (
        input: Partial<{ productId: string; text: string; now: Date }> = {},
    ): ReturnType<PublishPostUseCase["execute"]> =>
        new PublishPostUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: shop.id,
            productId: input.productId ?? "prod-1",
            text: input.text ?? "Barmoqlar ishlasa, bola tez gapiradi",
            now: input.now ?? NOW,
        })

    const sync = (): Promise<number> =>
        new SyncProductPostsUseCase(deps()).execute({
            businessId: shop.id,
            productId: "prod-1",
            now: NOW,
        })

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts(businesses)
        channels = new InMemoryShopChannels()
        links = new InMemorySourceLinks()
        publisher = new FakeChannelPublisher()
        shop = makeBusiness()
        await businesses.save(shop)
        await products.save(makeProduct({ price: 110_000, name: "Fetr kitobcha" }))
    })

    describe("connecting", () => {
        it("the owner's channel is connected; a new one replaces it", async () => {
            const first = await connect()
            expect(first.kind).toBe("connected")
            const second = await connect({ chatId: -1009, title: "Yangi kanal" })
            expect(second).toMatchObject({ kind: "connected" })
            expect(second.kind === "connected" && second.replaced?.chatId).toBe(CHAT)
            expect((await channels.find(shop.id))?.title).toBe("Yangi kanal")
        })

        it("the same channel again is no news, and its new title is kept", async () => {
            await connect()
            const again = await connect({ title: "ABC o'yinchoqlar" })
            expect(again.kind).toBe("unchanged")
            expect((await channels.find(shop.id))?.title).toBe("ABC o'yinchoqlar")
        })

        it("another admin of the connected channel changing the bot's rights keeps it", async () => {
            await connect()
            expect((await connect({ actor: STRANGER_TG })).kind).toBe("unchanged")
            expect((await channels.find(shop.id))?.chatId).toBe(CHAT)
        })

        it("someone else, or a demo shop, is refused", async () => {
            expect(await connect({ actor: STRANGER_TG })).toEqual({
                kind: "refused",
                why: "notOwner",
            })
            shop.makeDemo(NOW)
            expect(await connect()).toEqual({ kind: "refused", why: "demo" })
            expect(await channels.find(shop.id)).toBeNull()
        })

        it("losing it: only news about the channel connected now counts", async () => {
            await connect()
            const lose = new LoseShopChannelUseCase(channels)
            expect(await lose.execute({ businessId: shop.id, chatId: -1009 })).toBeNull()
            expect((await lose.execute({ businessId: shop.id, chatId: CHAT }))?.chatId).toBe(CHAT)
            expect(await channels.find(shop.id)).toBeNull()
        })

        it("«Kanalni uzish» is the owner's only", async () => {
            await connect()
            const disconnect = new DisconnectShopChannelUseCase(deps())
            await expect(
                disconnect.execute({ actorTelegramId: STRANGER_TG, businessId: shop.id }),
            ).rejects.toThrow(ForbiddenError)
            const removed = await disconnect.execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
            })
            expect(removed?.chatId).toBe(CHAT)
            expect(await channels.find(shop.id)).toBeNull()
        })
    })

    describe("«Kanalga joylash»", () => {
        it("posts the product with its facts and keeps where the post is", async () => {
            await connect()
            const post = await publish()
            expect(publisher.published).toHaveLength(1)
            expect(publisher.published[0]).toMatchObject({
                linkId: post.id,
                facts: { name: "Fetr kitobcha", price: 110_000 },
                ownerText: "Barmoqlar ishlasa, bola tez gapiradi",
            })
            expect(post.kind).toBe(SourceLinkKind.POST)
            expect(post.postUrl).toBe("https://t.me/c/1234567890/500")
            const saved = await links.findById(shop.id, post.id)
            expect(saved?.post).toEqual({ chatId: CHAT, messageId: 500, photoFileId: "AgAD" })
        })

        it("needs a connected channel, an active shop that is no demo, and a product on sale", async () => {
            await expect(publish()).rejects.toSatisfy(rule("CHANNEL_NOT_CONNECTED"))
            await connect()
            await expect(publish({ productId: "nope" })).rejects.toThrow(EntityNotFoundError)
            const other = makeProduct({ id: "prod-2", businessId: "biz-2" })
            await products.save(other)
            await expect(publish({ productId: "prod-2" })).rejects.toThrow(EntityNotFoundError)
            const product = await products.findById("prod-1")
            product?.setAvailability(false)
            if (product) {
                await products.save(product)
            }
            await expect(publish()).rejects.toSatisfy(rule("POST_PRODUCT_UNAVAILABLE"))
            shop.makeDemo(NOW)
            await expect(publish()).rejects.toSatisfy(rule("DEMO_NOT_PROMOTED"))
            expect(publisher.published).toHaveLength(0)
        })

        it("rights taken away disconnect the channel; nothing is kept", async () => {
            await connect()
            publisher.publishAnswer = "noRights"
            await expect(publish()).rejects.toSatisfy(rule("CHANNEL_NO_RIGHTS"))
            expect(await channels.find(shop.id)).toBeNull()
            expect(links.items.size).toBe(0)
        })

        it("a row that could not be written takes the post back from the channel", async () => {
            await connect()
            links.failInsert = true
            await expect(publish()).rejects.toThrow("D1 is down")
            expect(publisher.removed).toHaveLength(1)
        })
    })

    describe("the price changes", () => {
        it("edits only the posts whose name, price or age changed, in the channel of now", async () => {
            await connect()
            await publish()
            await publish()
            expect(await sync()).toBe(0)
            const product = await products.findById("prod-1")
            product?.update({ price: 99_000 })
            if (product) {
                await products.save(product)
            }
            expect(await sync()).toBe(2)
            expect(publisher.edited.map((e) => e.facts.price)).toEqual([99_000, 99_000])
            expect(await sync()).toBe(0)
        })

        it("a post deleted in Telegram leaves the list; lost rights disconnect", async () => {
            await connect()
            await publish()
            const product = await products.findById("prod-1")
            product?.update({ name: "Fetr kitob" })
            if (product) {
                await products.save(product)
            }
            publisher.editAnswer = "gone"
            expect(await sync()).toBe(0)
            expect([...links.items.values()].every((l) => !l.isLive)).toBe(true)

            await publish()
            product?.update({ name: "Fetr kitobcha" })
            if (product) {
                await products.save(product)
            }
            publisher.editAnswer = "noRights"
            expect(await sync()).toBe(0)
            expect(await channels.find(shop.id)).toBeNull()
        })

        it("edits at most the newest 20", async () => {
            await connect()
            for (let i = 0; i < MAX_SYNCED_POSTS + 2; i++) {
                await publish({ now: new Date(NOW.getTime() + i * 1000) })
            }
            const product = await products.findById("prod-1")
            product?.update({ price: 1_000 })
            if (product) {
                await products.save(product)
            }
            expect(await sync()).toBe(MAX_SYNCED_POSTS)
        })
    })

    describe("ad links", () => {
        const create = (
            label: string,
            productId?: string,
        ): ReturnType<CreateAdLinkUseCase["execute"]> =>
            new CreateAdLinkUseCase(deps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
                label,
                ...(productId === undefined ? {} : { productId }),
                now: NOW,
            })

        it("work without a channel, to the shop or to a product of it, up to 50", async () => {
            expect((await create("Super kids")).kind).toBe(SourceLinkKind.AD)
            expect((await create("Kanal", "prod-1")).productId).toBe("prod-1")
            await expect(create("Begona", "nope")).rejects.toThrow(EntityNotFoundError)
            for (let i = links.items.size; i < MAX_AD_LINKS; i++) {
                await create(`Reklama ${i}`)
            }
            await expect(create("Ortiqcha")).rejects.toSatisfy(rule("TOO_MANY_LINKS"))
        })

        it("are listed newest first with a lower-bound total", async () => {
            for (let i = 0; i < 3; i++) {
                await new CreateAdLinkUseCase(deps()).execute({
                    actorTelegramId: OWNER_TG,
                    businessId: shop.id,
                    label: `Reklama ${i}`,
                    now: new Date(NOW.getTime() + i * 1000),
                })
            }
            const page = await new ListSourceLinksUseCase(deps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
                kind: SourceLinkKind.AD,
                page: { page: 1, limit: 2 },
            })
            expect(page.data.map((l) => l.label)).toEqual(["Reklama 2", "Reklama 1"])
            expect(page.meta).toEqual({ page: 1, limit: 2, total: 3 })
            const posts = await new ListSourceLinksUseCase(deps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
                kind: SourceLinkKind.POST,
                page: { page: 1, limit: 20 },
            })
            expect(posts.data).toEqual([])
        })
    })

    describe("deleting", () => {
        it("a post is deleted in the channel first; refused, it stays", async () => {
            await connect()
            const post = await publish()
            const remove = new DeleteSourceLinkUseCase(deps())
            publisher.removeAnswer = "refused"
            await expect(
                remove.execute({
                    actorTelegramId: OWNER_TG,
                    businessId: shop.id,
                    linkId: post.id,
                    now: NOW,
                }),
            ).rejects.toSatisfy(rule("POST_NOT_DELETABLE"))
            expect((await links.findById(shop.id, post.id))?.isLive).toBe(true)
            publisher.removeAnswer = "removed"
            await remove.execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
                linkId: post.id,
                now: NOW,
            })
            expect((await links.findById(shop.id, post.id))?.isLive).toBe(false)
            await expect(
                remove.execute({
                    actorTelegramId: OWNER_TG,
                    businessId: shop.id,
                    linkId: post.id,
                    now: NOW,
                }),
            ).rejects.toThrow(EntityNotFoundError)
        })
    })

    describe("who came from where", () => {
        it("counts each person once, never the owner, and the order takes the last link for 7 days", async () => {
            const ad = await new CreateAdLinkUseCase(deps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
                label: "Super kids",
                now: NOW,
            })
            const open = new OpenSourceLinkUseCase(deps())
            const press = (
                telegramId: number,
                at = NOW,
            ): ReturnType<OpenSourceLinkUseCase["execute"]> =>
                open.execute({ businessId: shop.id, code: ad.id, telegramId, now: at })
            expect((await press(CUSTOMER_TG))?.id).toBe(ad.id)
            await press(CUSTOMER_TG)
            await press(OWNER_TG)
            expect((await links.findById(shop.id, ad.id))?.counts.opens).toBe(1)

            const source = new FindOrderSourceUseCase(links)
            const orderAt = (at: Date): Promise<string | undefined> =>
                source.execute({ businessId: shop.id, telegramId: CUSTOMER_TG, now: at })
            expect(await orderAt(new Date(NOW.getTime() + SOURCE_VISIT_WINDOW_MS - 1))).toBe(ad.id)
            expect(
                await orderAt(new Date(NOW.getTime() + SOURCE_VISIT_WINDOW_MS + 1)),
            ).toBeUndefined()
            expect(
                await source.execute({ businessId: shop.id, telegramId: OWNER_TG, now: NOW }),
            ).toBeUndefined()
        })

        it("an unknown, malformed or removed code is no link", async () => {
            const open = new OpenSourceLinkUseCase(deps())
            const at = { businessId: shop.id, telegramId: CUSTOMER_TG, now: NOW }
            expect(await open.execute({ ...at, code: "bad" })).toBeNull()
            expect(await open.execute({ ...at, code: "AAAAAAAAAAA" })).toBeNull()
            const ad = await new CreateAdLinkUseCase(deps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
                label: "Eski",
                now: NOW,
            })
            await new DeleteSourceLinkUseCase(deps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
                linkId: ad.id,
                now: NOW,
            })
            expect(await open.execute({ ...at, code: ad.id })).toBeNull()
        })
    })
})
