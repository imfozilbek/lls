/**
 * The shop's support group (owner's decision, November 2026; goal 21): a closed group with topics
 * connected from Telegram's own screen; a customer's message to the shop's bot goes to their own
 * topic there, and what the shop's people write in that topic goes back from the shop's bot.
 */
import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    CUSTOMER,
    OWNER,
    PIN,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
const GROUP_ID = -1005550001
const GROUP = { id: GROUP_ID, type: "supergroup", title: "ABC savollar", is_forum: true }
const STRANGER = { id: 3003, first_name: "Begona", language_code: "uz" }
const HELPER = { id: 4004, first_name: "Dilnoza", language_code: "uz" }

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("the shop's support group", () => {
    let client: TestClient
    let slug: string
    let updateId: number
    let messageId: number

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
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
        options: { from?: object; chat?: object; canManageTopics?: boolean } = {},
    ): Promise<void> =>
        shopUpdate({
            my_chat_member: {
                chat: options.chat ?? GROUP,
                from: options.from ?? OWNER,
                date: 0,
                new_chat_member: {
                    status,
                    user: { id: SHOP_BOT.id, is_bot: true, first_name: "Osh Markaz" },
                    ...(options.canManageTopics === undefined
                        ? {}
                        : { can_manage_topics: options.canManageTopics }),
                },
            },
        })
    const madeAdmin = (options: { from?: object; chat?: object } = {}): Promise<void> =>
        member("administrator", { ...options, canManageTopics: true })

    /** The customer writes to the shop's bot. */
    const customerSays = (fields: object, from: object = CUSTOMER): Promise<void> =>
        shopUpdate({
            message: {
                message_id: messageId++,
                from,
                chat: { id: (from as { id: number }).id, type: "private" },
                date: 0,
                ...fields,
            },
        })

    /** Someone of the shop writes in a topic of the group. */
    const shopSays = (threadId: number | undefined, fields: object = { text: "Bor, 110 000" }) =>
        shopUpdate({
            message: {
                message_id: messageId++,
                from: HELPER,
                chat: GROUP,
                date: 0,
                ...(threadId === undefined
                    ? {}
                    : { message_thread_id: threadId, is_topic_message: true }),
                ...fields,
            },
        })

    const toOwner = (): string[] =>
        client.telegram.sent.filter((m) => m.chatId === OWNER.id).map((m) => m.html)
    const toCustomer = (): string[] =>
        client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).map((m) => m.html)

    beforeEach(async () => {
        updateId = 1
        messageId = 10
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
    })

    describe("connecting", () => {
        it("«Guruhni bog'lash» gives Telegram's own screen and makes the bot hear it", async () => {
            const response = await owner()("/api/owner/support/connect", { method: "POST" })
            expect(response.status).toBe(200)
            expect(await json<{ url: string }>(response)).toEqual({
                url: "https://t.me/osh_markaz_bot?startgroup&admin=manage_topics+pin_messages",
            })
            expect(client.telegram.webhooks.at(-1)?.url).toContain(`/tg/${SHOP_BOT.id}`)
        })

        it("the owner's group with topics is connected: the owner and the group hear it", async () => {
            await madeAdmin()
            expect(toOwner().at(-1)).toContain("guruhi Zumdaga bog'landi")
            const hello = client.telegram.sent.find((m) => m.chatId === GROUP_ID)
            expect(hello?.html).toContain("@osh_markaz_bot")
            const got = await json<{ group: { title: string } | null }>(
                await owner()("/api/owner/support"),
            )
            expect(got.group?.title).toBe("ABC savollar")
            const shop = await json<{ supportChat: boolean }>(await as(CUSTOMER)("/api/shop"))
            expect(shop.supportChat).toBe(true)
        })

        it("someone else, a group without topics, or without the right: the bot leaves", async () => {
            await madeAdmin({ from: STRANGER })
            expect(toOwner().at(-1)).toContain("siz qo'shmadingiz")
            await madeAdmin({ chat: { ...GROUP, is_forum: false } })
            expect(toOwner().at(-1)).toContain("mavzular yoqilmagan")
            await member("administrator", { canManageTopics: false })
            expect(toOwner().at(-1)).toContain("mavzu ochish huquqi berilmadi")
            await member("member")
            expect(client.telegram.left.filter((l) => l.chatId === GROUP_ID)).toHaveLength(4)
            const got = await json<{ group: null }>(await owner()("/api/owner/support"))
            expect(got.group).toBeNull()
        })

        it("removed from the group, or the right taken, it is forgotten and the owner hears", async () => {
            await madeAdmin()
            await member("left")
            expect(toOwner().at(-1)).toContain("mavzu ocha olmaydi")
            await madeAdmin()
            await member("administrator", { canManageTopics: false })
            expect(toOwner().at(-1)).toContain("mavzu ocha olmaydi")
            const shop = await json<{ supportChat: boolean }>(await as(CUSTOMER)("/api/shop"))
            expect(shop.supportChat).toBe(false)
        })

        it("«Guruhni ajratish»: forgotten, and the bot leaves", async () => {
            await madeAdmin()
            const response = await owner()("/api/owner/support", { method: "DELETE" })
            expect(response.status).toBe(204)
            expect(client.telegram.left).toContainEqual({ token: SHOP_BOT_TOKEN, chatId: GROUP_ID })
            await member("left")
            expect(toOwner().at(-1)).not.toContain("mavzu ocha olmaydi")
        })

        it("is the owner's only", async () => {
            expect((await as(STRANGER)("/api/owner/support")).status).toBe(403)
            const connect = await as(STRANGER)("/api/owner/support/connect", { method: "POST" })
            expect(connect.status).toBe(403)
        })
    })

    describe("a customer's message", () => {
        it("without a support group the bot answers as before", async () => {
            await customerSays({ text: "Salom, bormi?" })
            expect(toCustomer().at(-1)).toContain("ish esa ilovada")
            expect(client.telegram.copies).toHaveLength(0)
        })

        it("goes to the customer's own topic, made once, with who they are", async () => {
            await madeAdmin()
            await customerSays({ text: "Salom, fetr kitobcha bormi?" })
            expect(client.telegram.topics).toEqual([
                expect.objectContaining({ chatId: GROUP_ID, name: "Aziz Karimov" }),
            ])
            const threadId = client.telegram.topics[0]?.threadId
            const card = client.telegram.sent.find((m) => m.options?.threadId === threadId)
            expect(card?.html).toContain("Aziz Karimov")
            expect(card?.html).toContain("Yangi mijoz")
            expect(client.telegram.copies.at(-1)).toMatchObject({
                fromChatId: CUSTOMER.id,
                toChatId: GROUP_ID,
                options: { threadId },
            })
            expect(toCustomer().at(-1)).toContain("do'konga yuborildi")

            const before = toCustomer().length
            await customerSays({ photo: [{ file_id: "p", width: 1, height: 1 }] })
            expect(client.telegram.topics).toHaveLength(1)
            expect(client.telegram.copies).toHaveLength(2)
            expect(toCustomer()).toHaveLength(before)
        })

        it("a topic deleted in Telegram is made again", async () => {
            await madeAdmin()
            await customerSays({ text: "Salom" })
            const first = client.telegram.topics[0]?.threadId ?? 0
            client.telegram.goneTopics.add(first)
            await customerSays({ text: "Yana savol" })
            expect(client.telegram.topics).toHaveLength(2)
            const second = client.telegram.topics[1]?.threadId
            expect(client.telegram.copies.at(-1)?.options?.threadId).toBe(second)
        })

        it("the bot that may not make topics any more: the group is forgotten", async () => {
            await madeAdmin()
            client.telegram.failTopics = true
            await customerSays({ text: "Salom" })
            expect(toCustomer().at(-1)).toContain("ish esa ilovada")
            expect(toOwner().at(-1)).toContain("mavzu ocha olmaydi")
        })

        it("the owner's own message and the customer's phone are never relayed", async () => {
            await madeAdmin()
            await customerSays({ text: "Sinov" }, OWNER)
            await customerSays({
                contact: { phone_number: "+998901234567", user_id: CUSTOMER.id },
            })
            expect(client.telegram.copies).toHaveLength(0)
        })
    })

    describe("the shop's answer", () => {
        let threadId: number

        beforeEach(async () => {
            await madeAdmin()
            await customerSays({ text: "Salom, bormi?" })
            threadId = client.telegram.topics[0]?.threadId ?? 0
        })

        it("in the customer's topic goes to the customer from the shop's bot", async () => {
            await shopSays(threadId)
            expect(client.telegram.copies.at(-1)).toMatchObject({
                token: SHOP_BOT_TOKEN,
                fromChatId: GROUP_ID,
                toChatId: CUSTOMER.id,
            })
        })

        it("the General topic, another group, a service note or a bot go nowhere", async () => {
            const copies = client.telegram.copies.length
            await shopSays(undefined)
            await shopSays(threadId, { forum_topic_created: { name: "x" } })
            await shopSays(threadId, {
                text: "bot",
                from: { id: 42, is_bot: true, first_name: "B" },
            })
            await shopUpdate({
                message: {
                    message_id: messageId++,
                    from: HELPER,
                    chat: { ...GROUP, id: -1009 },
                    message_thread_id: threadId,
                    is_topic_message: true,
                    text: "boshqa guruh",
                },
            })
            expect(client.telegram.copies).toHaveLength(copies)
            expect(client.telegram.sent.filter((m) => m.chatId === -1009)).toHaveLength(0)
        })

        it("an anonymous admin's answer goes too", async () => {
            await shopSays(threadId, {
                text: "Bor",
                from: { id: 1087968824, is_bot: true, first_name: "Group" },
                sender_chat: { id: GROUP_ID },
            })
            expect(client.telegram.copies.at(-1)?.toChatId).toBe(CUSTOMER.id)
        })

        it("a customer who blocked the bot: the topic hears it", async () => {
            client.telegram.notStarted.add(`${SHOP_BOT_TOKEN}:${CUSTOMER.id}`)
            await shopSays(threadId)
            const note = client.telegram.sent.at(-1)
            expect(note).toMatchObject({ chatId: GROUP_ID, options: { threadId } })
            expect(note?.html).toContain("botni bloklagan")
        })
    })

    describe("«Do'konga xabar yozish» in the app", () => {
        const pressed = (payload: string, from: object = CUSTOMER): Promise<void> =>
            shopUpdate({
                message: {
                    message_id: messageId++,
                    from,
                    chat: { id: (from as { id: number }).id, type: "private" },
                    date: 0,
                    text: `/start ${payload}`,
                },
            })

        it("on the customer's own order: the topic hears which, the customer is asked", async () => {
            await madeAdmin()
            const product = await json<{ id: string }>(
                await owner()("/api/owner/products", {
                    method: "POST",
                    json: { name: "Fetr kitobcha", price: 110_000, unit: "pcs", category: "meals" },
                }),
            )
            await as(CUSTOMER)("/api/me")
            await sharePhoneWithShops(CUSTOMER.id)
            const order = await json<{ id: string; number: number }>(
                await as(CUSTOMER)("/api/orders", {
                    method: "POST",
                    json: {
                        items: [{ productId: product.id, quantity: 1 }],
                        address: "Navoiy 12",
                        location: PIN,
                    },
                }),
            )
            await pressed(`q_o${order.id}`)
            const threadId = client.telegram.topics[0]?.threadId
            const inTopic = client.telegram.sent.filter((m) => m.options?.threadId === threadId)
            expect(inTopic[0]?.html).toContain("Oxirgi buyurtma: #1")
            expect(inTopic.at(-1)?.html).toContain("Mijoz #1 buyurtma haqida yozmoqchi")
            expect(toCustomer().at(-1)).toContain("#1 buyurtma bo'yicha savolingizni yozing")

            await pressed(`q_p${product.id}`)
            expect(client.telegram.sent.at(-2)?.html).toContain("«Fetr kitobcha» haqida")
            expect(toCustomer().at(-1)).toContain("«Fetr kitobcha» haqida savolingizni")
        })

        it("someone else's order is not told; without a group the bot greets", async () => {
            await pressed("q_onot-theirs")
            expect(toCustomer().at(-1)).toContain("Assalomu alaykum!")
            await madeAdmin()
            await pressed("q_onot-theirs", STRANGER)
            expect(client.telegram.sent.at(-1)).toMatchObject({ chatId: STRANGER.id })
            expect(client.telegram.sent.at(-1)?.html).toContain("Savolingizni yozing")
            expect(client.telegram.sent.some((m) => m.html.includes("haqida yozmoqchi"))).toBe(
                false,
            )
        })
    })
    describe("the topic tells who waits and who the customer is (goal 22)", () => {
        const threadOf = (): number => client.telegram.topics[0]?.threadId ?? 0
        const iconsOf = (): (string | undefined)[] =>
            client.telegram.topicEdits.map((e) => e.change.iconCustomEmojiId).filter(Boolean)

        it("a new topic waits (❓), its card pinned; an answer ✅, a new question ❓ again", async () => {
            await madeAdmin()
            await customerSays({ text: "Salom, bormi?" })
            expect(client.telegram.topics[0]).toMatchObject({
                name: "Aziz Karimov",
                icon: "icon-waiting",
            })
            const threadId = threadOf()
            const card = client.telegram.sent.find((m) => m.options?.threadId === threadId)
            expect(client.telegram.pins).toHaveLength(1)
            expect(card?.html).toContain("Yangi mijoz")

            await shopSays(threadId)
            await shopSays(threadId, { text: "Yana bir narsa" })
            expect(iconsOf()).toEqual(["icon-answered"])

            await customerSays({ text: "Rahmat, yana savol" })
            await customerSays({ text: "Yana bitta" })
            expect(iconsOf()).toEqual(["icon-answered", "icon-waiting"])
            expect(client.telegram.reopened).toEqual([{ chatId: GROUP_ID, threadId }])
        })

        it("a topic made before names were kept is named and given its card once", async () => {
            await madeAdmin()
            await customerSays({ text: "Salom" })
            const threadId = threadOf()
            // As goal 21 left it: no name kept, no card.
            await env.DB.prepare(
                "UPDATE support_threads SET topic_name = NULL, card_message_id = NULL",
            ).run()
            const pinsBefore = client.telegram.pins.length

            await customerSays({ text: "Yana savol" })
            const renamed = client.telegram.topicEdits.filter((e) => e.change.name !== undefined)
            expect(renamed).toEqual([
                { chatId: GROUP_ID, threadId, change: { name: "Aziz Karimov" } },
            ])
            expect(client.telegram.pins).toHaveLength(pinsBefore + 1)
            const row = await env.DB.prepare(
                "SELECT topic_name, card_message_id FROM support_threads",
            ).first<{ topic_name: string | null; card_message_id: number | null }>()
            expect(row?.topic_name).toBe("Aziz Karimov")
            expect(row?.card_message_id).toBe(client.telegram.pins.at(-1)?.messageId)

            await customerSays({ text: "Yana bitta" })
            expect(client.telegram.topicEdits.filter((e) => e.change.name)).toHaveLength(1)
            expect(client.telegram.pins).toHaveLength(pinsBefore + 1)
        })

        it("without the icons in Telegram's set the topic works as before", async () => {
            client.telegram.topicIcons = []
            await madeAdmin()
            await customerSays({ text: "Salom" })
            expect(client.telegram.topics[0]?.icon).toBeUndefined()
            await shopSays(threadOf())
            expect(client.telegram.copies.at(-1)?.toChatId).toBe(CUSTOMER.id)
            expect(iconsOf()).toEqual([])
        })

        it("an order: a line in the topic, the card written again, the name with the phone", async () => {
            await madeAdmin()
            await customerSays({ text: "Salom" })
            const threadId = threadOf()
            const cardId = client.telegram.pins[0]?.messageId
            const product = await json<{ id: string }>(
                await owner()("/api/owner/products", {
                    method: "POST",
                    json: { name: "Fetr kitobcha", price: 110_000, unit: "pcs", category: "meals" },
                }),
            )
            await as(CUSTOMER)("/api/me")
            await sharePhoneWithShops(CUSTOMER.id)
            await as(CUSTOMER)("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId: product.id, quantity: 1 }],
                    address: "Navoiy 12",
                    location: PIN,
                },
            })
            await expect
                .poll(() => client.telegram.topicEdits.some((e) => e.change.name !== undefined))
                .toBe(true)
            const line = client.telegram.sent.find(
                (m) => m.options?.threadId === threadId && m.html.startsWith("🛒 #1"),
            )
            expect(line?.html).toContain("karta")
            const card = client.telegram.edited.find((m) => m.messageId === cardId)
            expect(card?.html).toContain("1 ta buyurtma")
            expect(card?.html).toContain("📞 +998")
            const renamed = client.telegram.topicEdits.find((e) => e.change.name !== undefined)
            expect(renamed?.change.name).toMatch(/^Aziz Karimov · \d{2} \d{3} \d{2} \d{2}$/)
        })

        it("a card deleted in Telegram comes again, pinned", async () => {
            await madeAdmin()
            await customerSays({ text: "Salom" })
            const cardId = client.telegram.pins[0]?.messageId ?? 0
            client.telegram.deletedMessages.add(cardId)
            const product = await json<{ id: string }>(
                await owner()("/api/owner/products", {
                    method: "POST",
                    json: { name: "Osh", price: 35_000, unit: "pcs", category: "meals" },
                }),
            )
            await as(CUSTOMER)("/api/me")
            await sharePhoneWithShops(CUSTOMER.id)
            await as(CUSTOMER)("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId: product.id, quantity: 1 }],
                    address: "Navoiy 12",
                    location: PIN,
                },
            })
            await expect.poll(() => client.telegram.pins.length).toBe(2)
        })

        it("an order of someone without a topic writes nothing in the group", async () => {
            await madeAdmin()
            const product = await json<{ id: string }>(
                await owner()("/api/owner/products", {
                    method: "POST",
                    json: { name: "Osh", price: 35_000, unit: "pcs", category: "meals" },
                }),
            )
            await as(CUSTOMER)("/api/me")
            await sharePhoneWithShops(CUSTOMER.id)
            const placed = await as(CUSTOMER)("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId: product.id, quantity: 1 }],
                    address: "Navoiy 12",
                    location: PIN,
                },
            })
            expect(placed.status).toBe(201)
            const inGroup = client.telegram.sent.filter(
                (m) => m.chatId === GROUP_ID && m.options?.threadId !== undefined,
            )
            expect(inGroup).toHaveLength(0)
        })

        it("why the last try failed is in the app, until a group is connected", async () => {
            await madeAdmin({ chat: { ...GROUP, is_forum: false } })
            const failed = await json<{ refusal: { reason: string; title: string } | null }>(
                await owner()("/api/owner/support"),
            )
            expect(failed.refusal).toMatchObject({ reason: "notForum", title: "ABC savollar" })
            await madeAdmin()
            const connected = await json<{ refusal: null }>(await owner()("/api/owner/support"))
            expect(connected.refusal).toBeNull()
            await member("left")
            const lost = await json<{ refusal: { reason: string } }>(
                await owner()("/api/owner/support"),
            )
            expect(lost.refusal.reason).toBe("lost")
        })
    })
})
