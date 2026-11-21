import { beforeEach, describe, expect, it } from "vitest"

import {
    HISTORY_BATCH,
    ImportChannelHistoryUseCase,
    RecordChannelPostUseCase,
    RelinkChannelPostUseCase,
} from "../../application/use-cases/channel/channel-posts.use-cases.js"
import {
    DeleteSourceLinkUseCase,
    ListSourceLinksUseCase,
    SyncProductPostsUseCase,
} from "../../application/use-cases/channel/source-links.use-cases.js"
import { toShopChannelDTO } from "../../application/dtos/source-link.dto.js"
import { SourceLinkKind, SourceLinkOrigin } from "../../domain/entities/source-link.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { foldForGuess, guessPostProduct } from "../../domain/services/post-guess.js"
import { ShopChannel } from "../../domain/value-objects/shop-channel.js"
import { OWNER_TG, STRANGER_TG, makeBusiness, makeProduct } from "../fixtures.js"
import { InMemoryBusinesses, InMemoryProducts } from "../in-memory.js"
import {
    FakeChannelHistory,
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

describe("which product a post is about", () => {
    const catalog = [
        { id: "kubik", name: "Magnit konstruktor" },
        { id: "short", name: "Konstruktor" },
        { id: "doll", name: "Oʻyinchoq qoʻgʻirchoq" },
        { id: "osh", name: "Osh" },
    ]

    it("the one product the text names, whatever its case and apostrophes", () => {
        expect(guessPostProduct("🔥 Yangi MAGNIT konstruktor keldi!", catalog)).toBe("kubik")
        expect(guessPostProduct("O'yinchoq qo'g'irchoq, 3 yoshdan", catalog)).toBe("doll")
        expect(foldForGuess("Oʻyinchoq  TO’PLAMI")).toBe("o'yinchoq to'plami")
    })

    it("a name inside a longer one counts as the longer; only whole words count", () => {
        expect(guessPostProduct("Magnit konstruktor 64 dona", catalog)).toBe("kubik")
        expect(guessPostProduct("Konstruktorlar keldi", catalog)).toBeUndefined()
        expect(guessPostProduct("Konstruktor bor", catalog)).toBe("short")
    })

    it("two products, a name too short to tell, or no text: the whole shop", () => {
        expect(
            guessPostProduct("Magnit konstruktor va oʻyinchoq qoʻgʻirchoq", catalog),
        ).toBeUndefined()
        expect(guessPostProduct("Bugun osh bor", catalog)).toBeUndefined()
        expect(guessPostProduct(undefined, catalog)).toBeUndefined()
        const twins = [
            { id: "a", name: "Kubik" },
            { id: "b", name: "Kubik" },
        ]
        expect(guessPostProduct("Kubik keldi", twins)).toBeUndefined()
    })
})

describe("the channel's state", () => {
    it("keeps the bot's updates and the history read through a new title", () => {
        const before = ShopChannel.connect({
            businessId: "biz-1",
            chatId: CHAT,
            title: "ABC",
            username: "abc_kanal",
            connectedAt: NOW,
        })
            .withUpdates(2)
            .withHistory({ before: 120 })
        const renamed = ShopChannel.connect({
            businessId: "biz-1",
            chatId: CHAT,
            title: "ABC yangi",
            connectedAt: NOW,
        }).keepsStateOf(before)
        expect(renamed).toMatchObject({ title: "ABC yangi", updatesVersion: 2, historyBefore: 120 })
        expect(renamed.historyDone).toBe(false)
        expect(before.withHistory({ doneAt: NOW }).historyDone).toBe(true)
        expect(before.isPublic).toBe(true)
        expect(toShopChannelDTO(before).history).toBe("open")
        expect(toShopChannelDTO(before.withHistory({ doneAt: NOW })).history).toBe("done")
        expect(toShopChannelDTO(renamed).history).toBe("unavailable")
    })
})

describe("every post of the shop's channel", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let channels: InMemoryShopChannels
    let links: InMemorySourceLinks
    let publisher: FakeChannelPublisher
    let history: FakeChannelHistory
    let shop: Business

    const deps = (): {
        businesses: InMemoryBusinesses
        products: InMemoryProducts
        channels: InMemoryShopChannels
        links: InMemorySourceLinks
        publisher: FakeChannelPublisher
        history: FakeChannelHistory
    } => ({ businesses, products, channels, links, publisher, history })

    const record = (
        input: Partial<{ chatId: number; messageId: number; text: string; album: boolean }> = {},
    ): ReturnType<RecordChannelPostUseCase["execute"]> =>
        new RecordChannelPostUseCase(deps()).execute({
            businessId: shop.id,
            chatId: input.chatId ?? CHAT,
            messageId: input.messageId ?? 41,
            ...(input.text === undefined ? {} : { text: input.text }),
            album: input.album ?? false,
            now: NOW,
        })

    const importPage = (): ReturnType<ImportChannelHistoryUseCase["execute"]> =>
        new ImportChannelHistoryUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: shop.id,
            now: NOW,
        })

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts(businesses)
        channels = new InMemoryShopChannels()
        links = new InMemorySourceLinks()
        publisher = new FakeChannelPublisher()
        history = new FakeChannelHistory()
        shop = makeBusiness()
        await businesses.save(shop)
        await products.save(makeProduct({ price: 110_000, name: "Magnit konstruktor" }))
        await channels.save(
            ShopChannel.connect({
                businessId: shop.id,
                chatId: CHAT,
                title: "ABC",
                username: "abc_kanal",
                connectedAt: NOW,
            }),
        )
    })

    describe("a post the owner made in Telegram", () => {
        it("joins Zumda with «Buyurtma berish» to the product its text names", async () => {
            const link = await record({ text: "Yangi Magnit konstruktor keldi!\n\n110 000 so'm" })
            expect(link).toMatchObject({
                origin: SourceLinkOrigin.CHANNEL,
                productId: "prod-1",
                preview: "Yangi Magnit konstruktor keldi! 110 000 so'm",
                hasButton: true,
            })
            expect(publisher.attached).toEqual([{ linkId: link?.id, messageId: 41 }])
        })

        it("a post naming no product leads to the whole shop", async () => {
            const link = await record({ text: "Bugun soat 20:00 gacha ishlaymiz" })
            expect(link?.productId).toBeUndefined()
            expect(link?.hasButton).toBe(true)
        })

        it("is written once; another channel, or a post Zumda made, is left alone", async () => {
            await record()
            expect(await record()).toBeNull()
            expect(await record({ chatId: -1009, messageId: 7 })).toBeNull()
            expect(links.items.size).toBe(1)
            expect(publisher.attached).toHaveLength(1)
        })

        it("an album, or a post Telegram will not let the bot change, stays without a button", async () => {
            const album = await record({ messageId: 50, album: true, text: "Albom" })
            expect(album?.hasButton).toBe(false)
            publisher.attachAnswers.push({ kind: "refused" })
            const refused = await record({ messageId: 51 })
            expect(refused?.hasButton).toBe(false)
            expect(publisher.attached).toHaveLength(0)
        })

        it("an album without words is not kept: nothing to know it by, no button", async () => {
            expect(await record({ messageId: 52, album: true })).toBeNull()
            expect(links.items.size).toBe(0)
        })

        it("the same post twice at once: the button carries the code that was written", async () => {
            const first = await record({ text: "Magnit konstruktor" })
            // The second delivery passed the check before the first one was written.
            links.knownPosts = async (): Promise<Set<number>> => new Set()
            expect(await record({ text: "Magnit konstruktor" })).toBeNull()
            expect(links.items.size).toBe(1)
            expect(publisher.attached.map((a) => a.linkId)).toEqual([
                first?.id,
                expect.not.stringMatching(first?.id ?? ""),
                first?.id,
            ])
        })

        it("Telegram asking to wait keeps the post without a button; a bot out leaves it", async () => {
            publisher.attachAnswers.push({ kind: "wait", seconds: 3 })
            expect((await record({ messageId: 60 }))?.hasButton).toBe(false)
            publisher.attachAnswers.push({ kind: "gone" })
            expect(await record({ messageId: 61 })).toBeNull()
            publisher.attachAnswers.push({ kind: "noRights" })
            expect(await record({ messageId: 62 })).toBeNull()
            // Telegram's `my_chat_member` disconnects it and tells the owner.
            expect(await channels.find(shop.id)).not.toBeNull()
            expect(links.items.size).toBe(1)
        })

        it("the owner leads it to another product or to the whole shop; a Zumda post refuses", async () => {
            const link = await record({ text: "Bugun yangi narsalar" })
            const relink = (productId?: string): ReturnType<RelinkChannelPostUseCase["execute"]> =>
                new RelinkChannelPostUseCase(deps()).execute({
                    actorTelegramId: OWNER_TG,
                    businessId: shop.id,
                    linkId: link?.id ?? "",
                    ...(productId === undefined ? {} : { productId }),
                })
            expect((await relink("prod-1")).productId).toBe("prod-1")
            expect((await relink()).productId).toBeUndefined()
            await expect(
                new RelinkChannelPostUseCase(deps()).execute({
                    actorTelegramId: STRANGER_TG,
                    businessId: shop.id,
                    linkId: link?.id ?? "",
                }),
            ).rejects.toBeInstanceOf(ForbiddenError)
        })

        it("stands in the list with Zumda's posts; Zumda never deletes it nor rewrites its text", async () => {
            const link = await record({ text: "Magnit konstruktor" })
            const page = await new ListSourceLinksUseCase(deps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: shop.id,
                kind: SourceLinkKind.POST,
                page: { page: 1, limit: 20 },
            })
            expect(page.data).toEqual([
                expect.objectContaining({
                    origin: "channel",
                    button: true,
                    preview: "Magnit konstruktor",
                }),
            ])
            await expect(
                new DeleteSourceLinkUseCase(deps()).execute({
                    actorTelegramId: OWNER_TG,
                    businessId: shop.id,
                    linkId: link?.id ?? "",
                    now: NOW,
                }),
            ).rejects.toSatisfy(rule("POST_NOT_DELETABLE"))
            const product = await products.findById("prod-1")
            product?.update({ price: 99_000 })
            if (product) {
                await products.save(product)
            }
            expect(
                await new SyncProductPostsUseCase(deps()).execute({
                    businessId: shop.id,
                    productId: "prod-1",
                    now: NOW,
                }),
            ).toBe(0)
            expect(publisher.edited).toHaveLength(0)
        })
    })

    describe("the channel's past, read by the bot", () => {
        const posts = (
            from: number,
            to: number,
        ): { messageId: number; text: string; album: boolean }[] =>
            Array.from({ length: to - from + 1 }, (_, i) => ({
                messageId: to - i,
                text: `Post ${to - i}`,
                album: false,
            }))

        it("goes back page by page, ten posts a request, until the first post", async () => {
            history.posts = posts(1, 25)
            expect(await importPage()).toEqual({ kind: "more", added: HISTORY_BATCH })
            expect(await importPage()).toEqual({ kind: "more", added: HISTORY_BATCH })
            expect(await importPage()).toEqual({ kind: "done", added: 5 })
            expect(await importPage()).toEqual({ kind: "done", added: 0 })
            expect(links.items.size).toBe(25)
            expect(history.asked).toEqual([undefined, 16, 6])
        })

        it("passes over posts Zumda knows, and stops where Telegram asked to wait", async () => {
            history.posts = posts(1, 5)
            await record({ messageId: 4 })
            publisher.attachAnswers.push({ kind: "attached" }, { kind: "wait", seconds: 7 })
            expect(await importPage()).toEqual({ kind: "wait", added: 1, seconds: 7 })
            expect(await importPage()).toEqual({ kind: "done", added: 3 })
            expect([...links.items.values()].map((l) => l.post?.messageId).sort()).toEqual([
                1, 2, 3, 4, 5,
            ])
        })

        it("a private channel, or a page that cannot be read: only new posts come", async () => {
            await channels.save(
                ShopChannel.connect({
                    businessId: shop.id,
                    chatId: CHAT,
                    title: "Yopiq",
                    connectedAt: NOW,
                }),
            )
            expect(await importPage()).toEqual({ kind: "unavailable", added: 0 })
            history.unreadable = true
            await channels.save(
                ShopChannel.connect({
                    businessId: shop.id,
                    chatId: CHAT,
                    title: "ABC",
                    username: "abc_kanal",
                    connectedAt: NOW,
                }),
            )
            expect(await importPage()).toEqual({ kind: "unavailable", added: 0 })
        })

        it("only the owner, and the bot losing its rights says so", async () => {
            await expect(
                new ImportChannelHistoryUseCase(deps()).execute({
                    actorTelegramId: STRANGER_TG,
                    businessId: shop.id,
                    now: NOW,
                }),
            ).rejects.toBeInstanceOf(ForbiddenError)
            history.posts = posts(1, 3)
            publisher.attachAnswers.push({ kind: "noRights" })
            await expect(importPage()).rejects.toSatisfy(rule("CHANNEL_NO_RIGHTS"))
            expect(await channels.find(shop.id)).toBeNull()
        })
    })
})
