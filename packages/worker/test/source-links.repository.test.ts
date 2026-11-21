import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { ShopChannel, SourceLink, SourceLinkKind, SourceLinkOrigin } from "@zumda/core"

import {
    D1ShopChannelRepository,
    D1SourceLinkRepository,
} from "../src/repositories/source-link.repository.js"

import { SHOP_BOT, SHOP_BOT_TOKEN, createActiveShop, testClient } from "./helpers.js"

const NOW = new Date("2026-11-21T09:00:00Z")
const CHAT = -1001234567890

describe("the shop's channel and its links in D1", () => {
    let businessId: string
    let channels: D1ShopChannelRepository
    let links: D1SourceLinkRepository

    const at = (seconds: number): Date => new Date(NOW.getTime() + seconds * 1000)
    const ad = (label: string, seconds = 0): SourceLink =>
        SourceLink.ad({ businessId, label, now: at(seconds) })
    const post = (productId: string, chatId = CHAT, seconds = 0): SourceLink => {
        const link = SourceLink.post({ businessId, productId, postKey: "k1", now: at(seconds) })
        link.posted({ chatId, messageId: 100 + seconds, photoFileId: "file" })
        return link
    }

    beforeEach(async () => {
        const client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        await createActiveShop(client)
        const row = await env.DB.prepare("SELECT id FROM businesses").first<{ id: string }>()
        businessId = row?.id ?? ""
        channels = new D1ShopChannelRepository(env.DB)
        links = new D1SourceLinkRepository(env.DB)
    })

    it("keeps one channel per shop: a new one replaces it, removing forgets it", async () => {
        expect(await channels.find(businessId)).toBeNull()
        const connect = (chatId: number, title: string, username?: string): ShopChannel =>
            ShopChannel.connect({ businessId, chatId, title, username, connectedAt: NOW })
        await channels.save(connect(CHAT, "ABC", "ABC_bolalarrivoji"))
        expect(await channels.find(businessId)).toMatchObject({
            chatId: CHAT,
            title: "ABC",
            username: "ABC_bolalarrivoji",
        })
        await channels.save(connect(-1009, "Yangi"))
        const now = await channels.find(businessId)
        expect(now?.chatId).toBe(-1009)
        expect(now?.username).toBeUndefined()
        await channels.remove(businessId)
        expect(await channels.find(businessId)).toBeNull()
    })

    it("keeps what the bot heard and how far it read the channel's past", async () => {
        const channel = ShopChannel.connect({
            businessId,
            chatId: CHAT,
            title: "ABC",
            username: "abc_kanal",
            connectedAt: NOW,
        })
        await channels.save(channel.withUpdates(1).withHistory({ before: 571 }))
        expect(await channels.find(businessId)).toMatchObject({
            updatesVersion: 1,
            historyBefore: 571,
            historyDone: false,
        })
        await channels.save(channel.withHistory({ doneAt: at(5) }))
        const done = await channels.find(businessId)
        expect(done?.historyDoneAt).toEqual(at(5))
        expect(done?.historyBefore).toBeUndefined()
        expect(done?.updatesVersion).toBe(0)
    })

    it("a post made in Telegram: written once, found by its place, led elsewhere", async () => {
        const made = (messageId: number, productId?: string): SourceLink =>
            SourceLink.channelPost({
                businessId,
                ref: { chatId: CHAT, messageId },
                ...(productId === undefined ? {} : { productId }),
                text: "Fetr kitobcha keldi",
                now: NOW,
            })
        const first = made(576, "p-1")
        first.buttonAttached(at(1))
        expect(await links.insertChannelPost(first)).toBe(true)
        expect(await links.insertChannelPost(made(576))).toBe(false)
        expect(await links.insertChannelPost(made(580))).toBe(true)
        const read = await links.findByPost(CHAT, 576)
        expect(read).toMatchObject({
            id: first.id,
            origin: SourceLinkOrigin.CHANNEL,
            preview: "Fetr kitobcha keldi",
            productId: "p-1",
            buttonAt: at(1),
            hasButton: true,
        })
        expect(await links.findByPost(-1009, 576)).toBeNull()
        expect(await links.knownPosts(CHAT, [571, 576, 580])).toEqual(new Set([576, 580]))
        expect(await links.knownPosts(CHAT, [])).toEqual(new Set())
        if (read) {
            read.relink(undefined)
            await links.saveProduct(read)
        }
        expect((await links.findById(businessId, first.id))?.productId).toBeUndefined()
        // Zumda's own post of the product is the only one a new price edits.
        expect(await links.livePosts(businessId, "p-1", CHAT, 20)).toEqual([])
    })

    it("writes a post with where it is, and reads it back", async () => {
        const written = post("p-1")
        await links.insert(written)
        const read = await links.findById(businessId, written.id)
        expect(read?.post).toEqual({ chatId: CHAT, messageId: 100, photoFileId: "file" })
        expect(read?.kind).toBe(SourceLinkKind.POST)
        expect(read?.origin).toBe(SourceLinkOrigin.ZUMDA)
        expect(read?.isZumdaPost).toBe(true)
        expect(read?.counts).toEqual({ opens: 0, orders: 0, sales: 0, revenue: 0 })
        expect(await links.findById("another-shop", written.id)).toBeNull()
    })

    it("lists live links of a kind newest first; a removed one leaves the list", async () => {
        for (let i = 0; i < 3; i++) {
            await links.insert(ad(`Reklama ${i}`, i))
        }
        const page = await links.listLive(businessId, SourceLinkKind.AD, { offset: 0, limit: 2 })
        expect(page.map((l) => l.label)).toEqual(["Reklama 2", "Reklama 1"])
        const first = page[0]
        first?.remove(at(10))
        if (first) {
            await links.save(first)
        }
        const after = await links.listLive(businessId, SourceLinkKind.AD, { offset: 0, limit: 5 })
        expect(after.map((l) => l.label)).toEqual(["Reklama 1", "Reklama 0"])
        expect(await links.countLiveAds(businessId, 50)).toBe(2)
        expect(await links.countLiveAds(businessId, 1)).toBe(1)
    })

    it("a product's live posts, only in the channel asked for", async () => {
        await links.insert(post("p-1", CHAT, 1))
        await links.insert(post("p-1", CHAT, 2))
        await links.insert(post("p-1", -1009, 3))
        await links.insert(post("p-2", CHAT, 4))
        const live = await links.livePosts(businessId, "p-1", CHAT, 20)
        expect(live.map((l) => l.post?.messageId)).toEqual([102, 101])
        const channelPosts = await links.listLive(businessId, SourceLinkKind.POST, {
            offset: 0,
            limit: 10,
            chatId: CHAT,
        })
        expect(channelPosts).toHaveLength(3)
        const one = live[0]
        one?.resynced("k2")
        if (one) {
            await links.save(one)
        }
        expect((await links.findById(businessId, one?.id ?? ""))?.postKey).toBe("k2")
    })

    it("a visit counts the person once per link; the last link wins for the window", async () => {
        const first = ad("Super kids")
        const second = ad("O'ynab o'rganamiz")
        await links.insert(first)
        await links.insert(second)
        const visit = (linkId: string, seconds: number): Promise<void> =>
            links.recordVisit({ businessId, telegramId: 77, linkId, at: at(seconds) })
        await visit(first.id, 0)
        await visit(first.id, 1)
        await visit(second.id, 2)
        await visit(first.id, 3)
        expect((await links.findById(businessId, first.id))?.counts.opens).toBe(2)
        expect((await links.findById(businessId, second.id))?.counts.opens).toBe(1)
        expect(await links.lastVisit(businessId, 77, at(3))).toBe(first.id)
        expect(await links.lastVisit(businessId, 77, at(4))).toBeNull()
        expect(await links.lastVisit(businessId, 78, at(0))).toBeNull()
    })
})
