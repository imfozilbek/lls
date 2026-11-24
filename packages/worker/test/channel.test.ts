/**
 * The shop's own Telegram channel and its links (owner's decision, November 2026): the bot made
 * an admin from Telegram's own screen, a product posted with «Buyurtma berish», its price kept
 * true, named links for ads elsewhere, and who came from where.
 */
import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { MAX_AD_LINKS, SourceLink } from "@zumda/core"

import { D1SourceLinkRepository } from "../src/repositories/source-link.repository.js"

import {
    CUSTOMER,
    OWNER,
    PIN,
    RECEIPT_JPEG,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    hireCourier,
    sendReceipt,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
const CHAT = -1001234567890
const CHANNEL = { id: CHAT, type: "channel", title: "ABC o'yinchoqlar", username: "abc_kanal" }
const STRANGER = { id: 3003, first_name: "Begona", language_code: "uz" }
const COURIER = { id: 5005, first_name: "Jasur", language_code: "uz" }

interface LinkJson {
    id: string
    url: string
    postUrl?: string
    opens: number
    orders: number
    sales: number
    revenue: number
    label?: string
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("the shop's channel", () => {
    let client: TestClient
    let slug: string
    let productId: string
    let now: number
    let updateId: number

    let start: number
    // Signed at the clock's time: a request from 8 days later is signed then too.
    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug, authDate: new Date(now) })
    const owner = (): ReturnType<TestClient["as"]> => as(OWNER)

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

    const member = (
        status: string,
        options: { from?: object; chat?: object; canPost?: boolean } = {},
    ): Promise<void> =>
        shopUpdate({
            my_chat_member: {
                chat: options.chat ?? CHANNEL,
                from: options.from ?? OWNER,
                date: 0,
                new_chat_member: {
                    status,
                    user: { id: SHOP_BOT.id, is_bot: true, first_name: "Osh Markaz" },
                    ...(options.canPost === undefined
                        ? {}
                        : { can_post_messages: options.canPost }),
                },
            },
        })
    const madeAdmin = (options: { from?: object; chat?: object } = {}): Promise<void> =>
        member("administrator", { ...options, canPost: true })

    const pressed = (user: { id: number }, code: string): Promise<void> =>
        shopUpdate({
            message: {
                message_id: 1,
                from: user,
                chat: { id: user.id, type: "private" },
                date: 0,
                text: `/start s_${code}`,
            },
        })

    const post = (text = "Barmoqlar ishlasa, bola tez gapiradi", photo = true): Promise<Response> =>
        owner()(
            `/api/owner/channel/posts?productId=${productId}&text=${encodeURIComponent(text)}`,
            {
                method: "POST",
                ...(photo ? { headers: { "Content-Type": "image/jpeg" }, body: RECEIPT_JPEG } : {}),
            },
        )

    const toOwner = (): string[] =>
        client.telegram.sent.filter((m) => m.chatId === OWNER.id).map((m) => m.html)

    beforeEach(async () => {
        start = Date.now()
        now = start
        updateId = 1
        client = testClient({
            bots: { [SHOP_BOT_TOKEN]: SHOP_BOT },
            clock: { now: () => new Date(now) },
        })
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
    })

    describe("connecting", () => {
        it("«Kanalni ulash» gives Telegram's own screen and makes the bot hear it", async () => {
            const response = await owner()("/api/owner/channel/connect", { method: "POST" })
            expect(response.status).toBe(200)
            expect(await json<{ url: string }>(response)).toEqual({
                url: "https://t.me/osh_markaz_bot?startchannel&admin=post_messages+edit_messages+delete_messages",
            })
            expect(client.telegram.webhooks.at(-1)?.token).toBe(SHOP_BOT_TOKEN)
            expect(await json(await owner()("/api/owner/channel"))).toEqual({ channel: null })
        })

        it("the owner made the bot an admin: connected, told, with its subscribers", async () => {
            await madeAdmin()
            expect(toOwner().at(-1)).toContain("«ABC o'yinchoqlar»</b> kanali Zumdaga bog'landi")
            const channel = await json<{ channel: Record<string, unknown> }>(
                await owner()("/api/owner/channel"),
            )
            expect(channel.channel).toMatchObject({
                title: "ABC o'yinchoqlar",
                username: "abc_kanal",
                subscribers: 231,
            })
        })

        it("someone else added it: the bot leaves and the owner hears why", async () => {
            await madeAdmin({ from: STRANGER })
            expect(client.telegram.left).toEqual([{ token: SHOP_BOT_TOKEN, chatId: CHAT }])
            expect(toOwner().at(-1)).toContain("siz qo'shmadingiz")
            expect(await json(await owner()("/api/owner/channel"))).toEqual({ channel: null })
        })

        it("groups, private chats and other bots are no channel of the shop", async () => {
            const before = toOwner().length
            await madeAdmin({ chat: { id: -100555, type: "supergroup", title: "Guruh" } })
            await member("kicked", { chat: { id: CUSTOMER.id, type: "private" } })
            expect(await json(await owner()("/api/owner/channel"))).toEqual({ channel: null })
            // A group is the support group's (goal 21): never a word about a channel.
            expect(
                toOwner()
                    .slice(before)
                    .some((html) => html.includes("kanal")),
            ).toBe(false)
            expect(client.telegram.left.some((l) => l.chatId === CUSTOMER.id)).toBe(false)
        })

        it("a new channel replaces the old one; the echo of leaving it is no news", async () => {
            await madeAdmin()
            await madeAdmin({ chat: { id: -1009, type: "channel", title: "Yangi kanal" } })
            expect(client.telegram.left).toEqual([{ token: SHOP_BOT_TOKEN, chatId: CHAT }])
            const before = toOwner().length
            await member("left")
            expect(toOwner()).toHaveLength(before)
            const channel = await json<{ channel: { title: string } }>(
                await owner()("/api/owner/channel"),
            )
            expect(channel.channel.title).toBe("Yangi kanal")
        })

        it("removed, or left without the right to post: disconnected and the owner told", async () => {
            await madeAdmin()
            await member("administrator", { canPost: false })
            expect(toOwner().at(-1)).toContain("post joylay olmaydi")
            expect(await json(await owner()("/api/owner/channel"))).toEqual({ channel: null })
            await madeAdmin()
            await member("left")
            expect(await json(await owner()("/api/owner/channel"))).toEqual({ channel: null })
        })

        it("«Kanalni uzish»: forgotten and the bot leaves", async () => {
            await madeAdmin()
            const response = await owner()("/api/owner/channel", { method: "DELETE" })
            expect(response.status).toBe(204)
            expect(client.telegram.left).toEqual([{ token: SHOP_BOT_TOKEN, chatId: CHAT }])
            expect(await json(await owner()("/api/owner/channel"))).toEqual({ channel: null })
        })

        it("a demo shop has no channel", async () => {
            await env.DB.prepare("UPDATE businesses SET demo_at = 1").run()
            const response = await owner()("/api/owner/channel/connect", { method: "POST" })
            expect(response.status).toBe(422)
            expect((await json<{ error: { code: string } }>(response)).error.code).toBe(
                "DEMO_NOT_PROMOTED",
            )
            await madeAdmin()
            expect(client.telegram.left).toEqual([{ token: SHOP_BOT_TOKEN, chatId: CHAT }])
            expect(toOwner().at(-1)).toContain("Namuna do'kon kanalga bog'lanmaydi")
        })

        it("only the owner sees and changes it", async () => {
            expect((await as(CUSTOMER)("/api/owner/channel")).status).toBe(403)
            expect(
                (await as(CUSTOMER)("/api/owner/channel/connect", { method: "POST" })).status,
            ).toBe(403)
        })
    })

    describe("«Kanalga joylash»", () => {
        beforeEach(async () => {
            await madeAdmin()
        })

        it("posts the photo with the name, the owner's words, the price, the age and the button", async () => {
            const response = await post("Tugma <qadash> & ip")
            expect(response.status).toBe(201)
            const link = await json<LinkJson>(response)
            const sent = client.telegram.photoFiles.at(-1)
            expect(sent?.chatId).toBe(CHAT)
            expect(sent?.file.contentType).toBe("image/jpeg")
            expect(sent?.html).toBe(
                [
                    "<b>Fetr kitobcha</b>",
                    "",
                    "Tugma &lt;qadash&gt; &amp; ip",
                    "",
                    "💰 <b>110 000 so'm</b>",
                    "👶 3 yoshdan",
                ].join("\n"),
            )
            const button = sent?.options?.keyboard?.inline_keyboard[0]?.[0]
            expect(button).toMatchObject({ text: "🛒 Buyurtma berish", style: "success" })
            expect(button?.url).toBe(`https://t.me/osh_markaz_bot?start=s_${link.id}`)
            expect(link.url).toBe(button?.url)
            expect(link.postUrl).toMatch(/^https:\/\/t\.me\/abc_kanal\/\d+$/)
        })

        it("without a photo it is a text post", async () => {
            expect((await post("Yangi", false)).status).toBe(201)
            const sent = client.telegram.sent.at(-1)
            expect(sent?.chatId).toBe(CHAT)
            expect(sent?.html).toContain("<b>Fetr kitobcha</b>")
        })

        it("the longest post still fits Telegram's caption", async () => {
            const long = "Bolalar uchun 😊 ".repeat(60).slice(0, 850)
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { name: "N".repeat(80) },
            })
            expect((await post(long)).status).toBe(201)
            const caption = (client.telegram.photoFiles.at(-1)?.html ?? "").replace(/<[^>]+>/g, "")
            expect(caption.replace(/&lt;|&gt;|&amp;/g, "x").length).toBeLessThanOrEqual(1024)
            expect((await post("x".repeat(851))).status).toBe(400)
        })

        it("refused: no channel, a product off sale, lost rights, Telegram failing", async () => {
            await owner()("/api/owner/channel", { method: "DELETE" })
            const none = await post()
            expect(none.status).toBe(422)
            expect((await json<{ error: { code: string } }>(none)).error.code).toBe(
                "CHANNEL_NOT_CONNECTED",
            )
            await madeAdmin()
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { isAvailable: false },
            })
            expect((await json<{ error: { code: string } }>(await post())).error.code).toBe(
                "POST_PRODUCT_UNAVAILABLE",
            )
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { isAvailable: true },
            })
            client.telegram.channelError = "Bad Gateway"
            const failed = await post()
            expect(failed.status).toBe(502)
            expect((await json<{ error: { code: string } }>(failed)).error.code).toBe(
                "CHANNEL_POST_FAILED",
            )
            client.telegram.channelError =
                "Bad Request: need administrator rights in the channel chat"
            const rights = await post()
            expect((await json<{ error: { code: string } }>(rights)).error.code).toBe(
                "CHANNEL_NO_RIGHTS",
            )
            expect(await json(await owner()("/api/owner/channel"))).toEqual({ channel: null })
            const posts = await json<{ data: unknown[] }>(
                await owner()("/api/owner/links?kind=post"),
            )
            expect(posts.data).toEqual([])
        })
    })

    describe("a video post", () => {
        const VIDEO = new Uint8Array(4096).fill(7)
        // A browser tells the size; a test request does not, so it is said here.
        const video = (type = "video/mp4", size = VIDEO.byteLength): Promise<Response> =>
            owner()(`/api/owner/channel/posts?productId=${productId}&text=Ko'ring`, {
                method: "POST",
                headers: { "Content-Type": type, "Content-Length": String(size) },
                body: VIDEO,
            })

        beforeEach(async () => {
            await madeAdmin()
        })

        it("streams the video on to the channel with the words, the price and the button", async () => {
            const response = await video()
            expect(response.status).toBe(201)
            const sent = client.telegram.videoFiles.at(-1)
            expect(sent).toMatchObject({
                chatId: CHAT,
                name: "post.mp4",
                contentType: "video/mp4",
                bytes: VIDEO.byteLength,
            })
            expect(sent?.html).toContain("Ko'ring")
            expect(sent?.html).toContain("💰 <b>110 000 so'm</b>")
            expect(sent?.options?.keyboard?.inline_keyboard[0]?.[0]?.text).toBe(
                "🛒 Buyurtma berish",
            )
            expect(client.telegram.photoFiles).toHaveLength(0)
        })

        it("a new price edits its caption, never its text", async () => {
            await video()
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { price: 99_000 },
            })
            expect(client.telegram.captions.at(-1)?.html).toContain("💰 <b>99 000 so'm</b>")
            expect(client.telegram.edited.filter((m) => m.chatId === CHAT)).toHaveLength(0)
        })

        it("refuses a video Telegram does not show, and one over 50 MB", async () => {
            const webm = await video("video/webm")
            expect(webm.status).toBe(415)
            expect((await json<{ error: { code: string } }>(webm)).error.code).toBe(
                "UNSUPPORTED_VIDEO",
            )
            const big = await video("video/mp4", 50 * 1024 * 1024 + 1)
            expect(big.status).toBe(413)
            expect((await json<{ error: { code: string } }>(big)).error.code).toBe(
                "VIDEO_TOO_LARGE",
            )
            expect(client.telegram.videoFiles).toHaveLength(0)
        })
    })

    describe("a post stays true", () => {
        beforeEach(async () => {
            await madeAdmin()
            await post()
        })

        it("a new price edits the caption, keeping the owner's words and the button", async () => {
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { price: 99_000 },
            })
            const edit = client.telegram.captions.at(-1)
            expect(edit?.chatId).toBe(CHAT)
            expect(edit?.html).toContain("💰 <b>99 000 so'm</b>")
            expect(edit?.html).toContain("Barmoqlar ishlasa, bola tez gapiradi")
            expect(edit?.options?.keyboard?.inline_keyboard[0]?.[0]?.text).toBe(
                "🛒 Buyurtma berish",
            )
        })

        it("a change the post does not show, or a product off sale, edits nothing", async () => {
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { description: "Yangi tavsif", isAvailable: false },
            })
            expect(client.telegram.captions).toHaveLength(0)
        })

        it("a post deleted in Telegram leaves the list", async () => {
            client.telegram.channelError = "Bad Request: message to edit not found"
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { name: "Fetr kitob" },
            })
            const posts = await json<{ data: unknown[] }>(
                await owner()("/api/owner/links?kind=post"),
            )
            expect(posts.data).toEqual([])
        })

        it("«Postni o'chirish» deletes it in the channel; refused, it stays", async () => {
            const [link] = (
                await json<{ data: LinkJson[] }>(await owner()("/api/owner/links?kind=post"))
            ).data
            client.telegram.refuseDelete = true
            const refused = await owner()(`/api/owner/links/${link?.id}`, { method: "DELETE" })
            expect((await json<{ error: { code: string } }>(refused)).error.code).toBe(
                "POST_NOT_DELETABLE",
            )
            client.telegram.refuseDelete = false
            expect(
                (await owner()(`/api/owner/links/${link?.id}`, { method: "DELETE" })).status,
            ).toBe(204)
            expect(client.telegram.channelRemovals.at(-1)?.chatId).toBe(CHAT)
            const posts = await json<{ data: unknown[] }>(
                await owner()("/api/owner/links?kind=post"),
            )
            expect(posts.data).toEqual([])
        })
    })

    describe("ad links", () => {
        it("are made without a channel, listed with their address, up to 50", async () => {
            const made = await owner()("/api/owner/links", {
                method: "POST",
                json: { label: "Super kids", productId },
            })
            expect(made.status).toBe(201)
            const link = await json<LinkJson>(made)
            expect(link.url).toBe(`https://t.me/osh_markaz_bot?start=s_${link.id}`)
            const page = await json<{ data: LinkJson[]; meta: { total: number } }>(
                await owner()("/api/owner/links?kind=ad"),
            )
            expect(page.data.map((l) => l.label)).toEqual(["Super kids"])
            const links = new D1SourceLinkRepository(env.DB)
            const row = await env.DB.prepare("SELECT id FROM businesses").first<{ id: string }>()
            for (let i = 1; i < MAX_AD_LINKS; i++) {
                await links.insert(
                    SourceLink.ad({
                        businessId: row?.id ?? "",
                        label: `R${i}`,
                        now: new Date(now),
                    }),
                )
            }
            const over = await owner()("/api/owner/links", {
                method: "POST",
                json: { label: "Ortiqcha" },
            })
            expect((await json<{ error: { code: string } }>(over)).error.code).toBe(
                "TOO_MANY_LINKS",
            )
        })
    })

    describe("a pressed link", () => {
        const adLink = async (body: object): Promise<LinkJson> =>
            json<LinkJson>(await owner()("/api/owner/links", { method: "POST", json: body }))

        it("a post's button: the card with the post's photo and the storefront on the product", async () => {
            await madeAdmin()
            const link = await json<LinkJson>(await post())
            await pressed(CUSTOMER, link.id)
            const card = client.telegram.pictures.at(-1)
            expect(card?.chatId).toBe(CUSTOMER.id)
            expect(card?.photoUrl).toMatch(/^photo-\d+$/)
            expect(card?.html).toBe("<b>Fetr kitobcha</b>\n💰 <b>110 000 so'm</b>")
            const button = card?.options?.keyboard?.inline_keyboard[0]?.[0]
            expect(button?.text).toBe("🛍 Mahsulotni ko'rish")
            expect(button?.web_app?.url).toBe(
                `${env.APP_ORIGIN}/?shop=${slug}&product=${productId}`,
            )
        })

        it("counts each person once and never the owner", async () => {
            const link = await adLink({ label: "Super kids", productId })
            await pressed(CUSTOMER, link.id)
            await pressed(CUSTOMER, link.id)
            await pressed(OWNER, link.id)
            const page = await json<{ data: LinkJson[] }>(await owner()("/api/owner/links?kind=ad"))
            expect(page.data[0]?.opens).toBe(1)
            // The owner saw the card too: it is their own link.
            expect(
                client.telegram.sent.filter((m) => m.chatId === OWNER.id).at(-1)?.html,
            ).toContain("Fetr kitobcha")
        })

        it("a sold-out product says so; a deleted one says it is gone", async () => {
            const link = await adLink({ label: "Kanal", productId })
            await owner()(`/api/owner/products/${productId}`, {
                method: "PATCH",
                json: { stock: 0 },
            })
            await pressed(CUSTOMER, link.id)
            expect(client.telegram.sent.at(-1)?.html).toContain("Hozircha tugagan")
            await owner()(`/api/owner/products/${productId}`, { method: "DELETE" })
            await pressed(CUSTOMER, link.id)
            expect(client.telegram.sent.at(-1)?.html).toContain("Bu mahsulot endi sotilmaydi")
        })

        it("a link to the whole shop, or an unknown one, greets as usual", async () => {
            const link = await adLink({ label: "Instagram" })
            await pressed(CUSTOMER, link.id)
            expect(client.telegram.sent.at(-1)?.html).toContain("Assalomu alaykum!")
            await pressed(CUSTOMER, "AAAAAAAAAAA")
            expect(client.telegram.sent.at(-1)?.html).toContain("Assalomu alaykum!")
        })
    })

    describe("who came from where", () => {
        const place = async (): Promise<{ id: string }> =>
            json(
                await as(CUSTOMER)("/api/orders", {
                    method: "POST",
                    json: {
                        items: [{ productId, quantity: 2 }],
                        address: "Navoiy 12",
                        location: PIN,
                    },
                }),
            )
        const counts = async (): Promise<LinkJson | undefined> =>
            (await json<{ data: LinkJson[] }>(await owner()("/api/owner/links?kind=ad"))).data[0]

        beforeEach(async () => {
            await as(CUSTOMER)("/api/me")
            await sharePhoneWithShops(CUSTOMER.id)
        })

        it("the order counts for the last link pressed, its sale once it is delivered", async () => {
            await hireCourier(client, { slug }, COURIER)
            const link = await json<LinkJson>(
                await owner()("/api/owner/links", {
                    method: "POST",
                    json: { label: "Super kids" },
                }),
            )
            await pressed(CUSTOMER, link.id)
            const order = await place()
            expect(await counts()).toMatchObject({ opens: 1, orders: 1, sales: 0, revenue: 0 })
            await sendReceipt(as(CUSTOMER), order.id)
            await owner()(`/api/owner/orders/${order.id}/payment`, {
                method: "PATCH",
                json: { action: "paid" },
            })
            for (const status of ["preparing", "ready"]) {
                await owner()(`/api/owner/orders/${order.id}`, {
                    method: "PATCH",
                    json: { status },
                })
            }
            const courier = client.as(COURIER, { courierBot: true })
            for (const status of ["picked_up", "delivered"]) {
                await courier(`/api/courier/orders/${order.id}`, {
                    method: "PATCH",
                    json: { status },
                })
            }
            expect(await counts()).toMatchObject({ orders: 1, sales: 1, revenue: 220_000 })
        })

        it("after 7 days, or with no link pressed, the order counts for none", async () => {
            const link = await json<LinkJson>(
                await owner()("/api/owner/links", { method: "POST", json: { label: "Eski" } }),
            )
            await pressed(CUSTOMER, link.id)
            now = start + 8 * 24 * 60 * 60 * 1000
            await place()
            expect((await counts())?.orders).toBe(0)
            const stored = await env.DB.prepare("SELECT source_link_id FROM orders").first<{
                source_link_id: string | null
            }>()
            expect(stored?.source_link_id).toBeNull()
        })
    })
})
