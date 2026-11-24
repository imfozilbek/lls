/**
 * The shop's support group (owner's decision, November 2026; goal 21): a closed group with topics
 * connected from Telegram's own screen. A customer's message to the shop's bot goes to their own
 * topic there; what the shop's people write in the topic goes back from the shop's bot; the app's
 * «Do'konga xabar yozish» tells the topic which order or product it is about.
 */
import { expect, test } from "@playwright/test"

import { shopBySlug } from "../stand/config.js"
import { FOOD, PEOPLE, placeOrder, resetStand } from "../support/stand.js"
import {
    callsOf,
    controlTelegram,
    groupMembership,
    groupMessage,
    lastSeq,
    messagesTo,
    shopChat,
    waitForCall,
    waitForMessage,
} from "../support/telegram.js"
import { openApp, openSettings } from "../support/webapp.js"

import type { TgGroup } from "../support/telegram.js"
import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const GROUP: TgGroup = { id: -1005550001, title: "Osh Markaz savollar", isForum: true }
const HELPER = { id: 7007, first_name: "Dilnoza", language_code: "uz" }
const SHOP = shopBySlug(FOOD)
const P1 = "dev-food-p1"

/** The customer's topic, once the bot made it. */
async function topicOf(name: string, since: number): Promise<number> {
    let threadId = 0
    await expect
        .poll(async () => {
            const made = (await callsOf("createForumTopic", since)).find(
                (c) => c.body["name"] === name,
            )
            threadId = made ? await topicIdOf(made.seq) : 0
            return threadId
        })
        .toBeGreaterThan(0)
    return threadId
}

/** The id the fake Telegram gave the topic made by this call: its first message there. */
async function topicIdOf(seq: number): Promise<number> {
    const card = (await callsOf("sendMessage", seq)).find(
        (c) => Number(c.body["chat_id"]) === GROUP.id && c.body["message_thread_id"] !== undefined,
    )
    return Number(card?.body["message_thread_id"] ?? 0)
}

async function ownerSettings(page: Page): Promise<Awaited<ReturnType<typeof openApp>>> {
    const app = await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Mijozlar savollari")
    return app
}

test("without a group a customer's message gets the old answer", async () => {
    const since = await lastSeq()
    await shopChat(FOOD).send(PEOPLE.customer, "Salom, osh bormi?")
    await waitForMessage(PEOPLE.customer.id, "ish esa ilovada", since)
    expect(await callsOf("copyMessage", since)).toHaveLength(0)
})

test("the owner connects the group from Telegram's own screen", async ({ page }) => {
    const since = await lastSeq()
    const app = await ownerSettings(page)
    await expect(page.getByText("har bir mijozga alohida mavzu")).toBeVisible()
    await expect(page.getByText("Guruh sozlamalarida «Mavzular»ni yoqing.")).toBeVisible()
    await page.waitForTimeout(400) // entry animations, for the screenshot
    await page.screenshot({ path: "screenshots/support-connect.png" })
    await page.getByRole("button", { name: "Guruhni bog'lash" }).click()

    // The shop's bot hears the group from now on.
    const webhook = await waitForCall("setWebhook", SHOP.bot.token, since)
    expect(webhook.body["allowed_updates"]).toContain("my_chat_member")
    // The app opens Telegram's screen once its request came back: waited for, not raced.
    await expect
        .poll(
            async () =>
                (await app.calls()).filter((c) => c.method === "openTelegramLink").at(-1)?.args[0],
        )
        .toBe(`https://t.me/${SHOP.bot.username}?startgroup&admin=manage_topics+pin_messages`)
    await expect(page.getByText("Bog'lanishi bilan shu yerda ko'rinadi")).toBeVisible()

    await groupMembership(FOOD, PEOPLE.foodOwner, GROUP, "administrator")
    await waitForMessage(PEOPLE.foodOwner.id, "guruhi Zumdaga bog'landi", since)
    await waitForMessage(GROUP.id, `@${SHOP.bot.username}`, since)
    await app.fire("activated")
    await expect(page.getByRole("heading", { name: GROUP.title })).toBeVisible()
    await expect(page.getByText("Mijozlar xabari shu guruhga keladi")).toBeVisible()
    await page.waitForTimeout(400) // the card's entry animation, for the screenshot
    await page.screenshot({ path: "screenshots/support-connected.png" })
})

test("a group without topics, or added by someone else: the bot leaves", async () => {
    const since = await lastSeq()
    const plain: TgGroup = { id: -1005550009, title: "Oddiy guruh", isForum: false }
    await groupMembership(FOOD, PEOPLE.foodOwner, plain, "administrator")
    await waitForMessage(PEOPLE.foodOwner.id, "mavzular yoqilmagan", since)
    await groupMembership(FOOD, PEOPLE.stranger, { ...plain, isForum: true }, "administrator")
    await waitForMessage(PEOPLE.foodOwner.id, "guruhiga siz qo'shmadingiz", since)
    const left = await callsOf("leaveChat", since)
    expect(left.map((c) => Number(c.body["chat_id"]))).toEqual([plain.id, plain.id])
})

test("a customer writes: their own topic, and the shop's answer comes back", async () => {
    const since = await lastSeq()
    await shopChat(FOOD).send(PEOPLE.customer, "Salom, osh bormi?")
    const threadId = await topicOf("Aziz Karimov", since)
    const card = await waitForMessage(GROUP.id, "Aziz Karimov", since)
    expect(card.text).toContain("Shu mavzuga yozgan javobingiz mijozga boradi")
    const copy = (await callsOf("copyMessage", since)).at(-1)
    expect(copy?.body).toMatchObject({
        chat_id: GROUP.id,
        from_chat_id: PEOPLE.customer.id,
        message_thread_id: threadId,
    })
    await waitForMessage(PEOPLE.customer.id, "Xabaringiz do'konga yuborildi", since)

    // The next message goes to the same topic, without another word to the customer.
    const next = await lastSeq()
    await shopChat(FOOD).send(PEOPLE.customer, "Yana palov bormi?")
    await expect.poll(async () => (await callsOf("copyMessage", next)).length).toBe(1)
    expect(await callsOf("createForumTopic", next)).toHaveLength(0)
    expect(await messagesTo(PEOPLE.customer.id, next)).toHaveLength(0)

    // Dilnoza answers in the topic: the customer gets it from the shop's bot.
    const answer = await lastSeq()
    await groupMessage(FOOD, HELPER, GROUP, { threadId, text: "Bor, 35 000 so'm" })
    await expect
        .poll(async () => (await callsOf("copyMessage", answer)).at(-1)?.body["chat_id"])
        .toBe(PEOPLE.customer.id)
    // The General topic stays in the group.
    const general = await lastSeq()
    await groupMessage(FOOD, HELPER, GROUP, { text: "Bugun kim navbatchi?" })
    await expect.poll(async () => (await callsOf("copyMessage", general)).length).toBe(0)
})

test("a customer who blocked the bot: the topic hears it", async () => {
    const since = await lastSeq()
    const threadId = await topicOf("Aziz Karimov", 0)
    await controlTelegram({ blocked: [PEOPLE.customer.id] })
    await groupMessage(FOOD, HELPER, GROUP, { threadId, text: "Javob" })
    const note = await waitForMessage(GROUP.id, "Mijoz botni bloklagan", since)
    expect(note.text).not.toContain("Javob")
    await controlTelegram({ blocked: [] })
})

test("«Do'konga xabar yozish» on an order and a product tells the topic what about", async ({
    page,
}) => {
    const order = await placeOrder(PEOPLE.customerUz, FOOD, [{ productId: P1, quantity: 1 }])
    await openApp(page, {
        user: PEOPLE.customerUz,
        shop: FOOD,
        query: `?shop=${FOOD}&order=${order.id}`,
    })
    const write = page.getByRole("button", { name: "Do'konga xabar yozish" })
    await expect(write).toBeVisible()
    await page.screenshot({ path: "screenshots/support-order-button.png" })
    const since = await lastSeq()
    // The bot opens on `/start q_o<order>`, as Telegram would after the tap.
    await shopChat(FOOD).send(PEOPLE.customerUz, `/start q_o${order.id}`)
    const about = await waitForMessage(GROUP.id, `Mijoz #${order.number} buyurtma haqida`, since)
    expect(about.text).toContain("so'm")
    await waitForMessage(
        PEOPLE.customerUz.id,
        `#${order.number} buyurtma bo'yicha savolingizni yozing`,
        since,
    )
    const card = await waitForMessage(GROUP.id, "Malika", since)
    expect(card.text).toContain(`Oxirgi buyurtma: #${order.number}`)
})

test("the app's button opens the shop's bot on the order", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customerUz, FOOD, [{ productId: P1, quantity: 1 }])
    const app = await openApp(page, {
        user: PEOPLE.customerUz,
        shop: FOOD,
        query: `?shop=${FOOD}&order=${order.id}`,
    })
    await page.getByRole("button", { name: "Do'konga xabar yozish" }).click()
    const link = (await app.calls()).filter((c) => c.method === "openTelegramLink").at(-1)
    expect(link?.args[0]).toBe(`https://t.me/${SHOP.bot.username}?start=q_o${order.id}`)
})

test("«Guruhni ajratish»: the button leaves the customer's screens", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customerUz, FOOD, [{ productId: P1, quantity: 1 }])
    const since = await lastSeq()
    await ownerSettings(page)
    await page.getByRole("button", { name: "Guruhni ajratish" }).click()
    await expect(page.getByText("Guruh ajratildi")).toBeVisible()
    await expect.poll(async () => (await callsOf("leaveChat", since)).length).toBe(1)
    await openApp(page, {
        user: PEOPLE.customerUz,
        shop: FOOD,
        query: `?shop=${FOOD}&order=${order.id}`,
    })
    await expect(page.getByText(`#${order.number}`).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Do'konga xabar yozish" })).toHaveCount(0)
})
