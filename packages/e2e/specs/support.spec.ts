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
            // «Ism · telefon»: the name first, the phone after it when the shop has it.
            const made = (await callsOf("createForumTopic", since)).find((c) =>
                String(c.body["name"]).startsWith(name),
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

test("«Ishga tayyor» asks for the support group and leads to it", async ({ page }) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    const folded = page.getByRole("button", { expanded: false }).filter({ hasText: "Ishga tayyor" })
    if (await folded.count()) {
        await folded.click()
    }
    const ready = page.getByRole("region", { name: "Ishga tayyor" })
    const step = ready.getByRole("button", { name: /Mijozlar savollari uchun guruh/ })
    await expect(step).toBeVisible()
    await page.screenshot({ path: "screenshots/support-ready-step.png" })
    await step.click()
    await expect(page.getByRole("heading", { name: "Mijozlar savollari" })).toBeVisible()
})

test("a group without topics, or added by someone else: the bot leaves, the app says why", async ({
    page,
}) => {
    const since = await lastSeq()
    const plain: TgGroup = { id: -1005550009, title: "Oddiy guruh", isForum: false }
    await groupMembership(FOOD, PEOPLE.foodOwner, plain, "administrator")
    await waitForMessage(PEOPLE.foodOwner.id, "mavzular yoqilmagan", since)
    await groupMembership(FOOD, PEOPLE.stranger, { ...plain, isForum: true }, "administrator")
    await waitForMessage(PEOPLE.foodOwner.id, "guruhiga siz qo'shmadingiz", since)
    const left = await callsOf("leaveChat", since)
    expect(left.map((c) => Number(c.body["chat_id"]))).toEqual([plain.id, plain.id])

    // The owner opens «Mijozlar savollari»: the last refusal, said plainly, and the way again.
    await ownerSettings(page)
    const alert = page.getByRole("alert")
    await expect(alert).toContainText("«Oddiy guruh» guruhi bog'lanmadi")
    await expect(alert).toContainText("Botni guruhga boshqa odam qo'shdi")
    await expect(alert.getByRole("button", { name: "Qayta urinish" })).toBeVisible()
    // What to press in Telegram, a step at a time.
    await page.getByRole("button", { name: "Qanday qilinadi?" }).nth(1).click()
    await expect(page.getByText("«Mavzular» (Topics)ni yoqing")).toBeVisible()
    await page.waitForTimeout(400) // entry animations, for the screenshot
    await page.screenshot({ path: "screenshots/support-refused.png" })
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
    // The topic waits from the start (❓), its card pinned at the top.
    const made = (await callsOf("createForumTopic", since)).at(-1)
    expect(made?.body["icon_custom_emoji_id"]).toBe("icon-waiting")
    await expect.poll(async () => (await callsOf("pinChatMessage", since)).length).toBe(1)

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
    // Answered: ✅; a second answer changes nothing.
    await expect
        .poll(async () =>
            (await callsOf("editForumTopic", answer)).map((c) => c.body["icon_custom_emoji_id"]),
        )
        .toEqual(["icon-answered"])
    await groupMessage(FOOD, HELPER, GROUP, { threadId, text: "Yana kerakmi?" })
    await expect.poll(async () => (await callsOf("copyMessage", answer)).length).toBe(2)
    expect(await callsOf("editForumTopic", answer)).toHaveLength(1)
    // The customer asks again: ❓, and the topic opens if someone closed it.
    const again = await lastSeq()
    await shopChat(FOOD).send(PEOPLE.customer, "Qachon olib kelasiz?")
    await expect
        .poll(async () =>
            (await callsOf("editForumTopic", again)).map((c) => c.body["icon_custom_emoji_id"]),
        )
        .toEqual(["icon-waiting"])
    expect(await callsOf("reopenForumTopic", again)).toHaveLength(1)
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

test("a customer with a topic orders: a line in it, the card written again", async () => {
    const threadId = await topicOf("Aziz Karimov", 0)
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    const line = await waitForMessage(GROUP.id, `🛒 #${order.number}`, since)
    expect(line.text).toContain("so'm")
    const card = await waitForCall("editMessageText", SHOP.bot.token, since)
    expect(String(card.body["text"])).toContain("ta buyurtma")
    expect(String(card.body["text"])).toContain("📞")
    // The name carries the phone the customer gave the shop with the order.
    const names = [
        ...(await callsOf("createForumTopic", 0)),
        ...(await callsOf("editForumTopic", 0)),
    ].flatMap((c) => (typeof c.body["name"] === "string" ? [c.body["name"]] : []))
    expect(names.at(-1)).toMatch(/^Aziz Karimov · \d{2} \d{3} \d{2} \d{2}$/)
    expect(threadId).toBeGreaterThan(0)
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
