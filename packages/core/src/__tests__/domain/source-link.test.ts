import { describe, expect, it } from "vitest"

import { Product } from "../../domain/entities/product.js"
import {
    LINK_LABEL_MAX,
    POST_PREVIEW_MAX,
    POST_TEXT_MAX,
    PostMedia,
    SourceLink,
    SourceLinkKind,
    postHasCaption,
    postPreviewOf,
} from "../../domain/entities/source-link.js"
import { Unit } from "../../domain/enums/unit.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import { postFactsOf, postKeyOf } from "../../domain/services/post-facts.js"
import { ShopChannel } from "../../domain/value-objects/shop-channel.js"

const NOW = new Date("2026-11-21T09:00:00Z")

describe("a source link", () => {
    it("has an unguessable code that Telegram's start payload takes whole", () => {
        const codes = new Set(Array.from({ length: 200 }, () => SourceLink.newCode()))
        expect(codes.size).toBe(200)
        for (const code of codes) {
            expect(SourceLink.isCode(code)).toBe(true)
            expect(`s_${code}`).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
        }
        expect(SourceLink.isCode("short")).toBe(false)
        expect(SourceLink.isCode("abc$defghij")).toBe(false)
    })

    it("an ad link has a name of up to 40 letters and may open one product", () => {
        const link = SourceLink.ad({ businessId: "b", label: "  Super kids ", now: NOW })
        expect(link.kind).toBe(SourceLinkKind.AD)
        expect(link.label).toBe("Super kids")
        expect(link.productId).toBeUndefined()
        expect(link.counts).toEqual({ opens: 0, orders: 0, sales: 0, revenue: 0 })
        expect(() =>
            SourceLink.ad({ businessId: "b", label: "x".repeat(LINK_LABEL_MAX + 1), now: NOW }),
        ).toThrow(ValidationError)
        expect(() => SourceLink.ad({ businessId: "b", label: "  ", now: NOW })).toThrow(
            ValidationError,
        )
        const toOne = SourceLink.ad({ businessId: "b", label: "Kanal", productId: "p", now: NOW })
        expect(toOne.productId).toBe("p")
    })

    it("a post keeps the owner's words (up to 900) and is placed in the channel once", () => {
        const post = SourceLink.post({
            businessId: "b",
            productId: "p",
            ownerText: " Barmoqlar ishlasa, bola tez gapiradi ",
            postKey: "k",
            now: NOW,
        })
        expect(post.isPost).toBe(true)
        expect(post.ownerText).toBe("Barmoqlar ishlasa, bola tez gapiradi")
        expect(
            SourceLink.post({ businessId: "b", productId: "p", postKey: "k", now: NOW }).ownerText,
        ).toBeUndefined()
        expect(() =>
            SourceLink.post({
                businessId: "b",
                productId: "p",
                ownerText: "x".repeat(POST_TEXT_MAX + 1),
                postKey: "k",
                now: NOW,
            }),
        ).toThrow(ValidationError)
        post.posted({ chatId: -1001, messageId: 7 })
        expect(post.post).toEqual({ chatId: -1001, messageId: 7 })
        expect(() => post.posted({ chatId: -1001, messageId: 8 })).toThrow(ValidationError)
        const ad = SourceLink.ad({ businessId: "b", label: "Ad", now: NOW })
        expect(() => ad.posted({ chatId: -1001, messageId: 9 })).toThrow(ValidationError)
    })

    it("is removed once: the first time is kept", () => {
        const link = SourceLink.ad({ businessId: "b", label: "Ad", now: NOW })
        link.remove(NOW)
        link.remove(new Date(NOW.getTime() + 1000))
        expect(link.isLive).toBe(false)
        expect(link.deletedAt).toEqual(NOW)
    })

    it("a post made in Telegram keeps one line of its text, and only it changes its product", () => {
        const long = `${"Juda chiroyli o'yinchoq ".repeat(8)}\n\noxiri`
        const post = SourceLink.channelPost({
            businessId: "b",
            ref: { chatId: -100, messageId: 7 },
            text: long,
            now: NOW,
        })
        expect(post.preview?.length).toBeLessThanOrEqual(POST_PREVIEW_MAX)
        expect(post.preview?.endsWith("…")).toBe(true)
        expect(post.preview).not.toContain("\n")
        expect(postPreviewOf("   ")).toBeUndefined()
        expect(post.hasButton).toBe(false)
        post.buttonAttached(NOW)
        expect(post.hasButton).toBe(true)
        post.relink("p1")
        expect(post.productId).toBe("p1")
        const zumda = SourceLink.post({ businessId: "b", productId: "p1", postKey: "k", now: NOW })
        expect(zumda.hasButton).toBe(true)
        expect(() => zumda.relink("p2")).toThrow(ValidationError)
        expect(() => zumda.buttonAttached(NOW)).toThrow(ValidationError)
    })
})

describe("a post's facts", () => {
    const toy = (input: Partial<Parameters<typeof Product.create>[0]> = {}): Product =>
        Product.create({
            id: "p",
            businessId: "b",
            name: "Fetr kitobcha",
            price: 110_000,
            unit: Unit.PIECE,
            category: "educational_toys",
            ...input,
        })

    it("say the name, the price and the age", () => {
        expect(postFactsOf(toy({ ageFrom: 3 }))).toEqual({
            name: "Fetr kitobcha",
            price: 110_000,
            priceFrom: false,
            unit: Unit.PIECE,
            ageFrom: 3,
        })
    })

    it("with variants say the cheapest one, «… so'm dan»", () => {
        const facts = postFactsOf(
            toy({
                options: {
                    variants: [
                        { id: "s", name: "Kichik", price: 90_000 },
                        { id: "l", name: "Katta", price: 140_000 },
                    ],
                    addons: [],
                },
            }),
        )
        expect(facts.price).toBe(90_000)
        expect(facts.priceFrom).toBe(true)
    })

    it("change their key only when the name, the price, the unit or the age changes", () => {
        const product = toy()
        const before = postKeyOf(postFactsOf(product))
        product.update({ description: "Yangi tavsif", stock: 3 })
        expect(postKeyOf(postFactsOf(product))).toBe(before)
        product.update({ price: 99_000 })
        expect(postKeyOf(postFactsOf(product))).not.toBe(before)
    })
})

describe("the shop's channel", () => {
    const connect = (username?: string): ShopChannel =>
        ShopChannel.connect({
            businessId: "b",
            chatId: -1001234567890,
            title: " ABC o'yinchoqlar ",
            ...(username === undefined ? {} : { username }),
            connectedAt: NOW,
        })

    it("links a post by its username, or by its id when the channel is private", () => {
        expect(connect("ABC_bolalarrivoji").postUrl(488)).toBe("https://t.me/ABC_bolalarrivoji/488")
        expect(connect().postUrl(12)).toBe("https://t.me/c/1234567890/12")
        expect(connect().title).toBe("ABC o'yinchoqlar")
    })

    it("is a channel: a negative id and a real username", () => {
        expect(() =>
            ShopChannel.connect({ businessId: "b", chatId: 42, title: "x", connectedAt: NOW }),
        ).toThrow(ValidationError)
        expect(() => connect("no spaces")).toThrow(ValidationError)
        expect(connect().isSameChat(-1001234567890)).toBe(true)
        expect(connect().isSameChat(-1009)).toBe(false)
    })
})

describe("a post's words", () => {
    it("are a caption under a photo, a collage or a video; a message's text otherwise", () => {
        const at = { chatId: -100, messageId: 7 }
        expect(postHasCaption({ ...at, media: PostMedia.VIDEO })).toBe(true)
        expect(postHasCaption({ ...at, media: PostMedia.PHOTO })).toBe(true)
        // A photo post sent before the kind was kept: its photo's id tells it.
        expect(postHasCaption({ ...at, photoFileId: "AgAD" })).toBe(true)
        expect(postHasCaption(at)).toBe(false)
    })
})
