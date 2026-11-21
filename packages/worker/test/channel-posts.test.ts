/**
 * Every post of the shop's channel in Zumda (owner's decision, November 2026): a post the owner
 * makes in Telegram gets «Buyurtma berish» at once, to the product its words name or to the whole
 * shop; the channel's past is read by the bot from the channel's public page, ten posts a press.
 */
import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { WebChannelHistory } from "../src/telegram/channel-history.js"

import {
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
const CHAT = -1001234567890
const CHANNEL = { id: CHAT, type: "channel", title: "ABC o'yinchoqlar", username: "abc_kanal" }
const PAGE = 20

interface PostJson {
    id: string
    url: string
    origin: string
    preview?: string
    button: boolean
    productId?: string
    postUrl?: string
    opens: number
}

interface PagePost {
    id: number
    text?: string
    album?: boolean
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

/** The past, before the posts sent in the tests (18 November): a minute a post. */
function postedAt(id: number): string {
    return new Date(Date.UTC(2026, 10, 10, 10, id)).toISOString()
}

/** The channel's public page as `t.me/s` writes it: twenty posts, the oldest first. */
function pageOf(posts: readonly PagePost[], before: number | null): string {
    const older = posts
        .filter((post) => before === null || post.id < before)
        .sort((a, b) => b.id - a.id)
    const shown = older.slice(0, PAGE).reverse()
    const more =
        older.length > PAGE && shown[0]
            ? `<div class="tme_messages_more js-messages_more" data-before="${shown[0].id}"></div>`
            : ""
    const items = shown.map(
        (
            post,
        ) => `<div class="tgme_widget_message js-widget_message" data-post="abc_kanal/${post.id}">
${post.album ? '<div class="tgme_widget_message_grouped_wrap"></div>' : ""}
${post.text ? `<div class="tgme_widget_message_text js-message_text">${post.text}</div>` : ""}
<a class="tgme_widget_message_date"><time datetime="${postedAt(post.id)}">10:00</time></a>
</div>`,
    )
    return `<html><body><section>${more}${items.join("\n")}</section></body></html>`
}

describe("every post of the shop's channel", () => {
    let client: TestClient
    let slug: string
    let productId: string
    let updateId: number
    let pagePosts: PagePost[]
    let pageStatus: number
    const asked: string[] = []

    const owner = (): ReturnType<TestClient["as"]> =>
        client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: slug })

    async function shopUpdate(update: object): Promise<void> {
        const row = await env.DB.prepare("SELECT webhook_secret FROM businesses").first<{
            webhook_secret: string
        }>()
        const response = await client.request(`/tg/${SHOP_BOT.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [SECRET_HEADER]: row?.webhook_secret ?? "",
            },
            body: JSON.stringify({ update_id: updateId++, ...update }),
        })
        expect(response.status).toBe(200)
    }

    const madeAdmin = (chat: object = CHANNEL): Promise<void> =>
        shopUpdate({
            my_chat_member: {
                chat,
                from: OWNER,
                date: 0,
                new_chat_member: {
                    status: "administrator",
                    user: { id: SHOP_BOT.id, is_bot: true, first_name: "Osh Markaz" },
                    can_post_messages: true,
                },
            },
        })

    const channelPost = (fields: object): Promise<void> =>
        shopUpdate({
            channel_post: { message_id: 700, date: 1_795_000_000, chat: CHANNEL, ...fields },
        })

    const posts = async (): Promise<PostJson[]> =>
        (await json<{ data: PostJson[] }>(await owner()("/api/owner/links?kind=post"))).data

    const history = (): Promise<Response> =>
        owner()("/api/owner/channel/history", { method: "POST" })

    beforeEach(async () => {
        updateId = 1
        pagePosts = []
        pageStatus = 200
        asked.length = 0
        const pages = new WebChannelHistory(async (input) => {
            const url = new URL(String(input))
            asked.push(url.search)
            if (pageStatus !== 200) {
                return new Response(null, { status: pageStatus })
            }
            return new Response(pageOf(pagePosts, Number(url.searchParams.get("before")) || null))
        })
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT }, history: pages })
        slug = (await createActiveShop(client)).slug
        const product = await json<{ id: string }>(
            await owner()("/api/owner/products", {
                method: "POST",
                json: {
                    name: "Fetr kitobcha",
                    price: 110_000,
                    unit: "pcs",
                    category: "educational_toys",
                    ageFrom: 3,
                },
            }),
        )
        productId = product.id
        await madeAdmin()
    })

    describe("a post the owner made in Telegram", () => {
        it("gets «Buyurtma berish» at once, to the product its words name", async () => {
            await channelPost({ caption: "Yangi FETR kitobcha keldi!\n\n110 000 so'm" })
            const [post] = await posts()
            expect(post).toMatchObject({
                origin: "channel",
                productId,
                preview: "Yangi FETR kitobcha keldi! 110 000 so'm",
                button: true,
                postUrl: "https://t.me/abc_kanal/700",
                opens: 0,
            })
            const button = client.telegram.buttons.at(-1)
            expect(button).toMatchObject({ chatId: CHAT, messageId: 700 })
            expect(button?.keyboard.inline_keyboard[0]?.[0]).toMatchObject({
                text: "🛒 Buyurtma berish",
                url: `https://t.me/osh_markaz_bot?start=s_${post?.id}`,
            })
        })

        it("words naming no product lead to the whole shop", async () => {
            await channelPost({ text: "Bugun soat 20:00 gacha ishlaymiz" })
            const [post] = await posts()
            expect(post?.productId).toBeUndefined()
            expect(post?.button).toBe(true)
        })

        it("an album: the photo with the words stands for it, without a button", async () => {
            const album = { media_group_id: "13579" }
            await channelPost({ ...album, message_id: 710, caption: "Fetr kitobcha, 3 rangda" })
            await channelPost({ ...album, message_id: 711 })
            await channelPost({ ...album, message_id: 712 })
            const list = await posts()
            expect(list).toHaveLength(1)
            expect(list[0]).toMatchObject({ productId, button: false })
            expect(client.telegram.buttons).toHaveLength(0)
        })

        it("buttons already, another channel, or the same post again: left alone", async () => {
            const markup = { inline_keyboard: [[{ text: "Sayt", url: "https://example.uz" }]] }
            await channelPost({ message_id: 720, text: "Boshqa bot", reply_markup: markup })
            await channelPost({
                message_id: 721,
                text: "Boshqa kanal",
                chat: { id: -1009, type: "channel" },
            })
            await channelPost({ message_id: 722, text: "Bir marta" })
            await channelPost({ message_id: 722, text: "Bir marta" })
            expect(await posts()).toHaveLength(1)
            expect(client.telegram.buttons).toHaveLength(1)
        })

        it("Telegram refusing the button keeps the post, marked", async () => {
            client.telegram.buttonErrors.push("Bad Request: message can't be edited")
            await channelPost({ text: "Fetr kitobcha" })
            expect((await posts())[0]?.button).toBe(false)
            client.telegram.buttonErrors.push("Too Many Requests: retry after 9")
            await channelPost({ message_id: 701, text: "Fetr kitobcha" })
            expect((await posts())[0]?.button).toBe(false)
        })

        it("what Telegram's other answers mean for the post and the channel", async () => {
            client.telegram.buttonErrors.push(
                "Bad Request: message is not modified: specified new message content and reply markup are exactly the same",
            )
            await channelPost({ message_id: 730, text: "Bor edi" })
            client.telegram.buttonErrors.push("Bad Request: message to edit not found")
            await channelPost({ message_id: 731, text: "O'chirildi" })
            // Out of the channel: `my_chat_member` disconnects it and tells the owner, not this.
            client.telegram.buttonErrors.push("Forbidden: bot is not a member of the channel chat")
            await channelPost({ message_id: 732, text: "Bot chiqarildi" })
            expect((await posts()).map((post) => [post.preview, post.button])).toEqual([
                ["Bor edi", true],
            ])
            const channel = await json<{ channel: unknown }>(await owner()("/api/owner/channel"))
            expect(channel.channel).not.toBeNull()
        })

        it("its button counts for it; a new price never edits it; Zumda never deletes it", async () => {
            await channelPost({ text: "Fetr kitobcha" })
            const [post] = await posts()
            await shopUpdate({
                message: {
                    message_id: 1,
                    from: CUSTOMER,
                    chat: { id: CUSTOMER.id, type: "private" },
                    date: 0,
                    text: `/start s_${post?.id}`,
                },
            })
            expect(client.telegram.sent.at(-1)?.html).toContain("Fetr kitobcha")
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { price: 99_000 },
            })
            expect(client.telegram.captions).toHaveLength(0)
            expect(client.telegram.edited.filter((m) => m.chatId === CHAT)).toHaveLength(0)
            expect((await posts())[0]?.opens).toBe(1)
            const refused = await owner()(`/api/owner/links/${post?.id}`, { method: "DELETE" })
            expect((await json<{ error: { code: string } }>(refused)).error.code).toBe(
                "POST_NOT_DELETABLE",
            )
        })
    })

    describe("«Mahsulotni tanlash»", () => {
        const relink = (id: string, body: object, as = owner()): Promise<Response> =>
            as(`/api/owner/links/${id}`, { method: "PATCH", json: body })

        it("leads the owner's post to another product, or to the whole shop", async () => {
            await channelPost({ text: "Yangi narsalar keldi" })
            const [post] = await posts()
            const linked = await json<PostJson>(await relink(post?.id ?? "", { productId }))
            expect(linked).toMatchObject({ id: post?.id, productId, button: true })
            const whole = await json<PostJson>(await relink(post?.id ?? "", { productId: null }))
            expect(whole.productId).toBeUndefined()
            // The button in Telegram stays: it carries the link's code, not the product.
            expect(client.telegram.buttons).toHaveLength(1)
        })

        it("a Zumda post, someone else's product, a stranger: refused", async () => {
            await channelPost({ text: "Yangi narsalar" })
            const [post] = await posts()
            const zumda = await json<PostJson>(
                await owner()(`/api/owner/channel/posts?productId=${productId}`, {
                    method: "POST",
                }),
            )
            const own = await relink(zumda.id, { productId: null })
            expect(own.status).toBe(422)
            expect((await json<{ error: { code: string } }>(own)).error.code).toBe(
                "POST_NOT_RELINKABLE",
            )
            expect((await relink(post?.id ?? "", { productId: "nobody" })).status).toBe(404)
            const stranger = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
            expect((await relink(post?.id ?? "", { productId: null }, stranger)).status).toBe(403)
            expect((await relink(post?.id ?? "", { productId: 7 })).status).toBe(400)
        })
    })

    describe("the bot hears every post", () => {
        it("a channel connected before is registered again once, at the owner's next look", async () => {
            const before = client.telegram.webhooks.length
            const first = await json<{ channel: { history: string } }>(
                await owner()("/api/owner/channel"),
            )
            expect(first.channel.history).toBe("open")
            expect(client.telegram.webhooks).toHaveLength(before + 1)
            await owner()("/api/owner/channel")
            expect(client.telegram.webhooks).toHaveLength(before + 1)
            const row = await env.DB.prepare("SELECT updates_version FROM shop_channels").first<{
                updates_version: number
            }>()
            expect(row?.updates_version).toBe(1)
        })
    })

    describe("«Eski postlarni qo'shish»", () => {
        it("reads the past ten posts a press, back to the first post", async () => {
            pagePosts = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, text: `Post ${i + 1}` }))
            expect(await json(await history())).toEqual({ kind: "more", added: 10 })
            expect(await json(await history())).toEqual({ kind: "more", added: 10 })
            expect(await json(await history())).toEqual({ kind: "done", added: 5 })
            expect(asked).toEqual(["", "?before=16", "?before=6"])
            expect(await json(await history())).toEqual({ kind: "done", added: 0 })
            expect(asked).toHaveLength(3)
            expect(await posts()).toHaveLength(20)
            expect(client.telegram.buttons).toHaveLength(25)
            const channel = await json<{ channel: { history: string } }>(
                await owner()("/api/owner/channel"),
            )
            expect(channel.channel.history).toBe("done")
        })

        it("passes over known posts and albums without words; waits when Telegram asks", async () => {
            await channelPost({ message_id: 5, text: "Yangi post" })
            pagePosts = [
                { id: 1, text: "Fetr kitobcha" },
                { id: 2, album: true },
                { id: 3, album: true, text: "Albom" },
                { id: 4, text: "To'rtinchi" },
                { id: 5, text: "Yangi post" },
            ]
            client.telegram.buttonErrors.push("Too Many Requests: retry after 12")
            expect(await json(await history())).toEqual({ kind: "wait", added: 0, seconds: 12 })
            expect(await json(await history())).toEqual({ kind: "done", added: 3 })
            const list = await posts()
            expect(list.map((post) => post.preview)).toEqual([
                "Yangi post",
                "To'rtinchi",
                "Albom",
                "Fetr kitobcha",
            ])
            expect(list.find((post) => post.preview === "Fetr kitobcha")?.productId).toBe(productId)
        })

        it("a private channel: only new posts; Telegram's page down: a 502 to press again", async () => {
            pageStatus = 502
            const down = await history()
            expect(down.status).toBe(502)
            expect((await json<{ error: { code: string } }>(down)).error.code).toBe(
                "CHANNEL_HISTORY_FAILED",
            )
            pageStatus = 302
            expect(await json(await history())).toEqual({ kind: "unavailable", added: 0 })
            await madeAdmin({ id: -1009, type: "channel", title: "Yopiq kanal" })
            expect(await json(await history())).toEqual({ kind: "unavailable", added: 0 })
            const channel = await json<{ channel: { history: string } }>(
                await owner()("/api/owner/channel"),
            )
            expect(channel.channel.history).toBe("unavailable")
        })

        it("only the owner, and only with a channel", async () => {
            const stranger = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: slug })
            expect((await stranger("/api/owner/channel/history", { method: "POST" })).status).toBe(
                403,
            )
            await owner()("/api/owner/channel", { method: "DELETE" })
            const none = await history()
            expect((await json<{ error: { code: string } }>(none)).error.code).toBe(
                "CHANNEL_NOT_CONNECTED",
            )
        })
    })
})
