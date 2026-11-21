/**
 * The shop's own Telegram channel (owner's decision, November 2026): connected from Telegram's
 * own screen, a product posted with «Buyurtma berish», its price kept true, and named links for
 * ads elsewhere; every post and link says how many came, ordered and got it.
 */
import { expect, test } from "@playwright/test"

import { shopBySlug } from "../stand/config.js"
import {
    FOOD,
    PEOPLE,
    WATER,
    apiAs,
    payAndStart,
    placeOrder,
    resetStand,
} from "../support/stand.js"
import {
    callsOf,
    channelMembership,
    lastSeq,
    messagesTo,
    shopChat,
    waitForCall,
    waitForMessage,
} from "../support/telegram.js"
import { openApp, openSettings } from "../support/webapp.js"

import type { TgChannel } from "../support/telegram.js"
import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const CHANNEL: TgChannel = {
    id: -1001234567890,
    title: "Osh Markaz yangiliklari",
    username: "osh_markaz_news",
}
const P1 = "dev-food-p1"
const SHOP = shopBySlug(FOOD)

async function productName(id: string): Promise<string> {
    const read = await apiAs(PEOPLE.customer, "/shop/products", { shop: FOOD })
    const page = (await read.json()) as { data: { id: string; name: string }[] }
    return page.data.find((product) => product.id === id)?.name ?? ""
}

async function ownerSettings(
    page: Page,
    group: string,
): Promise<Awaited<ReturnType<typeof openApp>>> {
    const app = await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, group)
    return app
}

/** The code at the end of a post's or a link's address: `?start=s_<code>`. */
function codeOf(url: string | undefined): string {
    return url?.match(/start=s_([A-Za-z0-9_-]{11})$/)?.[1] ?? ""
}

test("the owner connects the channel from Telegram's own screen", async ({ page }) => {
    const since = await lastSeq()
    const app = await ownerSettings(page, "Telegram kanal")
    await expect(page.getByText("mahsulotni bir tugma bilan kanalga joylaysiz")).toBeVisible()
    await page.waitForTimeout(400) // entry animations, for the screenshot
    await page.screenshot({ path: "screenshots/channel-connect.png" })
    await page.getByRole("button", { name: "Kanalni bog'lash" }).click()

    // The shop's bot hears the channel from now on (a shop connected before needs no reconnect).
    const webhook = await waitForCall("setWebhook", SHOP.bot.token, since)
    expect(webhook.body["allowed_updates"]).toContain("my_chat_member")
    const link = (await app.calls()).filter((c) => c.method === "openTelegramLink").at(-1)
    expect(link?.args[0]).toBe(
        `https://t.me/${SHOP.bot.username}?startchannel&admin=post_messages+edit_messages+delete_messages`,
    )
    await expect(page.getByText("Bog'lanishi bilan shu yerda ko'rinadi")).toBeVisible()

    // The owner picked the channel and made the bot its admin there.
    await channelMembership(FOOD, PEOPLE.foodOwner, CHANNEL, "administrator")
    await waitForMessage(PEOPLE.foodOwner.id, "kanali Zumdaga bog'landi", since)
    await app.fire("activated")
    await expect(page.getByRole("heading", { name: CHANNEL.title })).toBeVisible()
    await expect(page.getByText("@osh_markaz_news · 231 obunachi")).toBeVisible()
    await expect(page.getByText("Hozircha post yo'q")).toBeVisible()
    await page.screenshot({ path: "screenshots/channel-connected.png" })
})

test("someone else makes the bot an admin of their channel: it leaves, the owner hears why", async () => {
    const since = await lastSeq()
    const other: TgChannel = { id: -1009876543210, title: "Begona kanal" }
    await channelMembership(FOOD, PEOPLE.stranger, other, "administrator")
    const news = await waitForMessage(PEOPLE.foodOwner.id, "kanaliga siz qo'shmadingiz", since)
    expect(news.text).toContain("<b>«Begona kanal»</b>")
    const left = await callsOf("leaveChat", since)
    expect(left.map((c) => Number(c.body["chat_id"]))).toEqual([other.id])
})

test("a product goes to the channel; a customer's tap opens it and orders", async ({ page }) => {
    const name = await productName(P1)
    const since = await lastSeq()
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click()
    await page.getByRole("button", { name: "Kanalga joylash" }).click()
    const sheet = page.getByRole("dialog", { name: "Kanalga joylash" })
    await expect(sheet.getByText("Kanalda shunday ko'rinadi")).toBeVisible()
    await sheet.getByLabel("Post matni").fill("Bugun issiq, darhol yetkazamiz!")
    const preview = sheet.getByRole("figure", { name: "Kanalda shunday ko'rinadi" })
    await expect(preview.getByText("Bugun issiq, darhol yetkazamiz!")).toBeVisible()
    await expect(preview.getByText("🛒 Buyurtma berish")).toBeVisible()
    await expect(preview.getByText(name, { exact: true })).toBeVisible()
    await page.screenshot({ path: "screenshots/channel-post-sheet.png" })
    await sheet.getByRole("button", { name: "Joylash", exact: true }).click()
    await expect(page.getByText("Post kanalga joylandi")).toBeVisible()

    const [post] = await messagesTo(CHANNEL.id, since)
    expect(post?.text).toContain(`<b>${name}</b>`)
    expect(post?.text).toContain("Bugun issiq, darhol yetkazamiz!")
    expect(post?.buttons.map((b) => b.text)).toEqual(["🛒 Buyurtma berish"])
    const code = codeOf(post?.buttons[0]?.url)
    expect(code).toHaveLength(11)

    // A subscriber presses «Buyurtma berish»: the shop's bot answers with the product's card.
    const pressed = await lastSeq()
    await shopChat(FOOD).send(PEOPLE.customer, `/start s_${code}`)
    const card = await waitForMessage(PEOPLE.customer.id, name, pressed)
    const open = card.buttons.find((b) => b.web_app)
    expect(open?.text).toBe("🛍 Mahsulotni ko'rish")
    expect(open?.web_app?.url).toContain(`shop=${FOOD}&product=${P1}`)

    // The storefront opens right on the product; the order counts for the post.
    const customer = await page.context().newPage()
    await openApp(customer, {
        user: PEOPLE.customer,
        shop: FOOD,
        query: `?shop=${FOOD}&product=${P1}`,
    })
    await expect(customer.getByRole("dialog", { name })).toBeVisible()
    await customer.screenshot({ path: "screenshots/channel-product-opened.png" })
    await customer.close()
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 2 }])

    // Delivered: the post counts the sale and its goods.
    expect((await payAndStart(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    const owner = (path: string, json: unknown, method = "PATCH"): Promise<Response> =>
        apiAs(PEOPLE.foodOwner, path, { shop: FOOD, method, json })
    expect((await owner(`/owner/orders/${order.id}/courier`, { self: true }, "PUT")).status).toBe(
        200,
    )
    for (const status of ["ready", "picked_up", "delivered"]) {
        expect((await owner(`/owner/orders/${order.id}`, { status })).status, status).toBe(200)
    }
})

test("the post says what it brought; a new price edits it", async ({ page }) => {
    await ownerSettings(page, "Telegram kanal")
    const posts = page.getByRole("listitem").filter({ hasText: "kishi kirdi" })
    await expect(posts).toHaveCount(1)
    await expect(posts.first()).toContainText("1 kishi kirdi · 1 ta buyurtma · 1 ta yetkazildi:")
    await page.screenshot({ path: "screenshots/channel-posts.png" })

    const since = await lastSeq()
    const changed = await apiAs(PEOPLE.foodOwner, `/owner/products/${P1}`, {
        shop: FOOD,
        method: "PATCH",
        json: { price: 41_000 },
    })
    expect(changed.status).toBe(200)
    await expect
        .poll(async () => (await messagesTo(CHANNEL.id, since)).at(-1)?.text ?? "")
        .toContain("41")
    const edited = (await messagesTo(CHANNEL.id, since)).at(-1)
    expect(edited?.method).toBe("editMessageText")
    expect(edited?.text).toContain("Bugun issiq, darhol yetkazamiz!")
    expect(edited?.buttons.map((b) => b.text)).toEqual(["🛒 Buyurtma berish"])
})

test("an ad link for another channel: made in the app, counted when pressed", async ({ page }) => {
    await ownerSettings(page, "Havola, QR-kod va vitrina")
    await expect(page.getByText("Hozircha havola yo'q.")).toBeVisible()
    await page.getByRole("button", { name: "Yangi havola" }).click()
    const sheet = page.getByRole("dialog", { name: "Yangi havola" })
    await sheet.getByRole("button", { name: "Saqlash" }).click()
    await expect(page.getByText("Havolaga nom bering")).toBeVisible()
    await sheet.getByLabel("Nomi").fill("Super kids")
    await sheet.getByRole("tab", { name: "Bitta mahsulot" }).click()
    const name = await productName(P1)
    await sheet.getByRole("option", { name }).click()
    await page.screenshot({ path: "screenshots/channel-ad-link-sheet.png" })
    await sheet.getByRole("button", { name: "Saqlash" }).click()
    await expect(
        page.getByText("Havola tayyor. Nusxalang va reklama matniga qo'shing."),
    ).toBeVisible()

    const row = page.getByRole("listitem").filter({ hasText: "Super kids" })
    await expect(row).toContainText(name)
    await expect(row).toContainText("Hali hech kim kirmadi")
    const shown = await row.getByText(`t.me/${SHOP.bot.username}?start=s_`).textContent()
    const code = codeOf(`https://${shown ?? ""}`)
    expect(code).toHaveLength(11)

    // Pressed by a customer (and by the owner, who never counts).
    await shopChat(FOOD).send(PEOPLE.customerUz, `/start s_${code}`)
    await shopChat(FOOD).send(PEOPLE.foodOwner, `/start s_${code}`)
    await waitForMessage(PEOPLE.customerUz.id, name)
    await page.reload()
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Havola, QR-kod va vitrina")
    await expect(page.getByRole("listitem").filter({ hasText: "Super kids" })).toContainText(
        "1 kishi kirdi · 0 ta buyurtma",
    )
    await page.screenshot({ path: "screenshots/channel-ad-links.png" })
})

test("«Postni o'chirish» deletes the post in the channel", async ({ page }) => {
    await ownerSettings(page, "Telegram kanal")
    const since = await lastSeq()
    await page.getByRole("button", { name: "Postni o'chirish" }).click()
    await expect(page.getByText("Post o'chirildi")).toBeVisible()
    const deleted = await callsOf("deleteMessage", since)
    expect(deleted.map((c) => Number(c.body["chat_id"]))).toContain(CHANNEL.id)
    await expect(page.getByText("Hozircha post yo'q")).toBeVisible()
})

test("the bot is no longer the channel's admin: the owner hears it, the app offers it again", async ({
    page,
}) => {
    const since = await lastSeq()
    await channelMembership(FOOD, PEOPLE.foodOwner, CHANNEL, "left")
    await waitForMessage(PEOPLE.foodOwner.id, "kanaliga post joylay olmaydi", since)
    await ownerSettings(page, "Telegram kanal")
    await expect(page.getByRole("button", { name: "Kanalni bog'lash" })).toBeVisible()
})

test("a demo shop connects no channel: the bot leaves at once", async () => {
    const water = shopBySlug(WATER)
    const made = await apiAs(PEOPLE.admin, `/admin/shops/${water.id}/demo`, {
        adminBot: true,
        method: "PUT",
        json: { template: "water" },
    })
    expect(made.status).toBe(200)
    const since = await lastSeq()
    const demoChannel: TgChannel = { id: -1005555555555, title: "Toza suv" }
    await channelMembership(WATER, PEOPLE.waterOwner, demoChannel, "administrator")
    await waitForMessage(PEOPLE.waterOwner.id, "Namuna do'kon kanalga bog'lanmaydi", since)
    const left = await callsOf("leaveChat", since)
    expect(left.map((c) => Number(c.body["chat_id"]))).toEqual([demoChannel.id])
})
