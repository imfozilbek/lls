/**
 * Every post of the shop's channel in Zumda (owner's decision, November 2026): a post the owner
 * makes in Telegram gets «Buyurtma berish» at once, to the product its words name or to the whole
 * shop, and the owner may lead it elsewhere; the channel's past is read by the bot from the
 * channel's public page, ten posts a request, Telegram's «wait» waited out by the app.
 */
import { expect, test } from "@playwright/test"

import { shopBySlug } from "../stand/config.js"
import { FOOD, PEOPLE, apiAs, resetStand } from "../support/stand.js"
import {
    callsOf,
    channelMembership,
    channelPost,
    controlTelegram,
    lastSeq,
    shopChat,
    waitForMessage,
} from "../support/telegram.js"
import { openApp, openSettings } from "../support/webapp.js"

import type { BotCall, TgChannel } from "../support/telegram.js"
import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })

const CHANNEL: TgChannel = {
    id: -1001234567891,
    title: "Osh Markaz kanali",
    username: "osh_markaz_kanal",
}
const P1 = "dev-food-p1"
const SHOP = shopBySlug(FOOD)
/** The channel's past on its public page: 25 posts before the ones made in the tests. */
const PAST = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, text: `Eski post ${i + 1}` }))

interface Keyboard {
    inline_keyboard: { text: string; url?: string }[][]
}

test.beforeAll(async () => {
    await resetStand()
    await channelMembership(FOOD, PEOPLE.foodOwner, CHANNEL, "administrator")
})

async function productName(id: string): Promise<string> {
    const read = await apiAs(PEOPLE.customer, "/shop/products", { shop: FOOD })
    const page = (await read.json()) as { data: { id: string; name: string }[] }
    return page.data.find((product) => product.id === id)?.name ?? ""
}

async function ownerChannel(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Telegram kanal")
}

/** The buttons the shop's bot put under one post of the channel. */
async function buttonsUnder(messageId: number, since: number): Promise<BotCall[]> {
    return (await callsOf("editMessageReplyMarkup", since)).filter(
        (call) =>
            Number(call.body["chat_id"]) === CHANNEL.id &&
            Number(call.body["message_id"]) === messageId,
    )
}

function codeOf(call: BotCall | undefined): string {
    const markup = call?.body["reply_markup"] as Keyboard | undefined
    return markup?.inline_keyboard[0]?.[0]?.url?.match(/start=s_([A-Za-z0-9_-]{11})$/)?.[1] ?? ""
}

test("a post the owner makes in Telegram gets «Buyurtma berish» to the product it names", async ({
    page,
}) => {
    const name = await productName(P1)
    const since = await lastSeq()
    const sent = await channelPost(FOOD, CHANNEL, {
        messageId: 141,
        caption: `Bugun ${name} bor! Issiq, darhol yetkazamiz`,
    })
    expect(sent.status).toBe(200)
    await expect.poll(async () => (await buttonsUnder(141, since)).length).toBe(1)
    const [call] = await buttonsUnder(141, since)
    const button = (call?.body["reply_markup"] as Keyboard).inline_keyboard[0]?.[0]
    expect(button?.text).toBe("🛒 Buyurtma berish")
    expect(button?.url).toMatch(new RegExp(`^https://t\\.me/${SHOP.bot.username}\\?start=s_`))

    await ownerChannel(page)
    const row = page.getByRole("listitem").filter({ hasText: "Issiq, darhol yetkazamiz" })
    await expect(row).toContainText("Siz joylagan")
    await expect(row).toContainText(`Qayerga olib boradi: ${name}`)
    await expect(row).toContainText("Tugmasi bor")
    await expect(row.getByRole("button", { name: "Postni o'chirish" })).toHaveCount(0)
    await page.waitForTimeout(400) // entry animations, for the screenshot
    await page.screenshot({ path: "screenshots/channel-own-post.png" })

    // A customer presses it: the product's card, and the post counts the visit.
    await shopChat(FOOD).send(PEOPLE.customerUz, `/start s_${codeOf(call)}`)
    await waitForMessage(PEOPLE.customerUz.id, name, since)
})

test("words naming no product lead to the whole shop; «Mahsulotni tanlash» changes it", async ({
    page,
}) => {
    const name = await productName(P1)
    const since = await lastSeq()
    await channelPost(FOOD, CHANNEL, { messageId: 142, text: "Bugun soat 23:00 gacha ishlaymiz" })
    await expect.poll(async () => (await buttonsUnder(142, since)).length).toBe(1)

    await ownerChannel(page)
    const row = page.getByRole("listitem").filter({ hasText: "23:00 gacha ishlaymiz" })
    await expect(row).toContainText("Qayerga olib boradi: Hamma mahsulotlar")
    await row.getByRole("button", { name: "Mahsulotni tanlash" }).click()
    const sheet = page.getByRole("dialog", { name: "Post qaysi mahsulotga olib borsin?" })
    await sheet.getByRole("tab", { name: "Bitta mahsulot" }).click()
    await sheet.getByRole("option", { name }).click()
    await page.screenshot({ path: "screenshots/channel-relink-sheet.png" })
    await sheet.getByRole("button", { name: "Saqlash" }).click()
    await expect(page.getByText("Endi shu mahsulotga olib boradi")).toBeVisible()
    await expect(row).toContainText(`Qayerga olib boradi: ${name}`)
    // The button in Telegram stays as it was: it carries the link's code, not the product.
    expect(await buttonsUnder(142, since)).toHaveLength(1)
})

test("an album keeps its words without a button; another channel and a new price change nothing", async ({
    page,
}) => {
    const since = await lastSeq()
    const album = { albumId: "10001" }
    await channelPost(FOOD, CHANNEL, {
        messageId: 143,
        caption: "Yangi menyu, 3 ta rasm",
        ...album,
    })
    await channelPost(FOOD, CHANNEL, { messageId: 144, caption: undefined, ...album })
    await channelPost(FOOD, CHANNEL, {
        messageId: 7,
        text: "Begona kanal posti",
        chatId: -1009998887776,
    })
    const changed = await apiAs(PEOPLE.foodOwner, `/owner/products/${P1}`, {
        shop: FOOD,
        method: "PATCH",
        json: { price: 43_000 },
    })
    expect(changed.status).toBe(200)

    await ownerChannel(page)
    const row = page.getByRole("listitem").filter({ hasText: "Yangi menyu, 3 ta rasm" })
    await expect(row).toContainText("Tugmasi yo'q")
    await expect(row).toContainText("Bir nechta rasm bilan chiqqan post ostiga Telegram")
    await expect(page.getByRole("listitem").filter({ hasText: "Begona kanal posti" })).toHaveCount(
        0,
    )
    // The owner's words are theirs: no button under the album, no edit of any post.
    expect(await callsOf("editMessageReplyMarkup", since)).toHaveLength(0)
    expect(await callsOf("editMessageCaption", since)).toHaveLength(0)
    expect(await callsOf("editMessageText", since)).toHaveLength(0)
    await page.screenshot({ path: "screenshots/channel-album-post.png" })
})

test("«Eski postlarni ham qo'shish» reads the channel's past, waiting when Telegram asks", async ({
    page,
}) => {
    test.setTimeout(60_000)
    await controlTelegram({ channelPages: { [CHANNEL.username ?? ""]: PAST } })
    // Longer than the Worker waits itself (5 s): the app waits it out and goes on.
    await controlTelegram({ buttonsRetryAfter: 6 })
    const since = await lastSeq()
    await ownerChannel(page)
    await expect(page.getByText("Kanaldagi oldingi postlarni ham qo'shing")).toBeVisible()
    await page.getByRole("button", { name: "Eski postlarni ham qo'shish" }).click()
    await expect(page.getByText(/soniyadan keyin o'zi davom etadi/)).toBeVisible()
    await page.screenshot({ path: "screenshots/channel-history-wait.png" })
    await expect(page.getByText("Eski postlarning hammasi qo'shildi")).toBeVisible({
        timeout: 30_000,
    })
    await page.screenshot({ path: "screenshots/channel-history-done.png" })

    const buttons = (await callsOf("editMessageReplyMarkup", since)).filter(
        (call) => Number(call.body["chat_id"]) === CHANNEL.id,
    )
    // 25 posts, the first try of one of them answered «wait».
    expect(new Set(buttons.map((call) => Number(call.body["message_id"]))).size).toBe(25)
    expect(buttons).toHaveLength(26)
    await expect(page.getByRole("listitem").filter({ hasText: "Eski post 25" })).toBeVisible()
    // The page a second time: nothing more to read, nothing written twice.
    await page.reload()
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Telegram kanal")
    await expect(page.getByText("Eski postlarning hammasi qo'shildi")).toBeVisible()
    await expect(page.getByRole("button", { name: "Eski postlarni ham qo'shish" })).toHaveCount(0)
})
