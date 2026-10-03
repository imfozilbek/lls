/**
 * Goal 14: a new owner creates the shop's bot from the Zumda bot without ever seeing a token
 * (Telegram Managed Bots), and manages every shop of theirs from «Mening bizneslarim».
 */
import { expect, test } from "@playwright/test"

import { managedBotToken, newBotUsername } from "../stand/config.js"
import { PEOPLE, apiAs, resetStand } from "../support/stand.js"
import {
    callsOf,
    lastSeq,
    managedBotUpdate,
    businessChat,
    waitForCall,
    waitForMessage,
} from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { TgUser } from "../support/telegram.js"
import type { Page } from "@playwright/test"

const OWNER: TgUser = { id: 4101, first_name: "Kamola", language_code: "uz" }
const LINK_OWNER: TgUser = { id: 4102, first_name: "Ulug'bek", language_code: "uz" }
const BOT_ID = 777200300
const LINK_BOT_ID = 777200301

interface MyShop {
    id: string
    slug: string
    name: string
    status: string
    botUsername: string
}

async function myShops(owner: TgUser): Promise<MyShop[]> {
    return (await (await apiAs(owner, "/platform/shops", { businessBot: true })).json()) as MyShop[]
}

/** Step 1: the business. */
async function describeBusiness(page: Page, name: string): Promise<void> {
    await bottomButton(page).click() // «Boshlash»
    await page.getByLabel("Biznes nomi").fill(name)
    await page.getByRole("radio", { name: "Ovqat", exact: true }).click()
    await bottomButton(page).click()
    await expect(page.getByText("2/3-qadam")).toBeVisible()
}

/** Step 3: delivery and the card, then the application goes to the admin. */
async function finishApplication(page: Page): Promise<void> {
    await bottomButton(page).click() // «Keyingi» after the bot
    await page.getByLabel("Yetkazish narxi").fill("8000")
    await page.getByLabel("Karta raqami").fill("4111 1111 1111 1111")
    await page.getByLabel("Kartadagi ism").fill("Kamola Rahimova")
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Ariza yuborildi!" })).toBeVisible()
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("«Bot yaratish»: the bot is created in Telegram's window, no token anywhere", async ({
    page,
}) => {
    const app = await openApp(page, {
        user: OWNER,
        businessBot: true,
        version: "9.6",
        createsBot: BOT_ID,
    })
    await describeBusiness(page, "Kamola Somsa")
    await expect(page.getByRole("heading", { name: "Biznesingiz boti" })).toBeVisible()
    await expect(bottomButton(page)).toHaveText("Bot yaratish")
    const since = await lastSeq()
    await bottomButton(page).click()

    await expect(page.getByText(`Bot yaratildi: @${newBotUsername(BOT_ID)}`)).toBeVisible()
    const [prepared] = await callsOf("savePreparedKeyboardButton", since)
    const button = prepared?.body["button"] as {
        request_managed_bot: { suggested_name: string; suggested_username: string }
    }
    expect(button.request_managed_bot).toMatchObject({
        suggested_name: "Kamola Somsa",
        suggested_username: "kamola_somsa_bot",
    })
    const [request] = (await app.calls()).filter((c) => c.method === "requestChat")
    expect(request?.args[0]).toBe(`prepared-${prepared?.seq ?? 0}`)
    // The owner also hears it in the Zumda bot, with the way back to the application.
    const told = await waitForMessage(OWNER.id, "yaratildi", since)
    expect(told.buttons[0]?.web_app?.url).toContain("mode=business")
    await expect(page.locator("body")).not.toContainText("NEW-managed")

    await finishApplication(page)
    const [shop] = await myShops(OWNER)
    expect(shop?.botUsername).toBe(newBotUsername(BOT_ID))
    // Zumda's picture goes on the new bot with the token only Zumda holds.
    await waitForCall("setMyProfilePhoto", managedBotToken(BOT_ID, 1), since)
})

test("approval connects the created bot like any other", async () => {
    const card = await waitForMessage(PEOPLE.admin.id, "Kamola Somsa")
    const since = await lastSeq()
    await businessChat().press(PEOPLE.admin, card.buttons[0]?.callback_data ?? "")
    await waitForMessage(OWNER.id, "ishga tushdi", since)
    const hook = await waitForCall("setWebhook", managedBotToken(BOT_ID, 1), since)
    expect(hook.body["url"]).toBe(`http://localhost:8787/tg/${BOT_ID}`)
    expect((await myShops(OWNER))[0]?.status).toBe("active")
})

test("«Mening bizneslarim» opens the shop's owner section right in the Zumda bot", async ({
    page,
}) => {
    const app = await openApp(page, { user: OWNER, businessBot: true })
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
    await page.getByRole("button", { name: /Kamola Somsa/ }).click()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    await expect(page.getByLabel("Nomi", { exact: true })).toHaveValue("Kamola Somsa")
    await app.back()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
})

test("someone else's shop is closed to them from the Zumda bot (403)", async () => {
    const [shop] = await myShops(OWNER)
    const stranger = await apiAs(PEOPLE.stranger, "/owner/shop", {
        shop: shop?.slug,
        businessBot: true,
    })
    expect(stranger.status).toBe(403)
    const owner = await apiAs(OWNER, "/owner/shop", { shop: shop?.slug, businessBot: true })
    expect(owner.status).toBe(200)
})

test("a new token from BotFather is picked up: the bot is connected again", async () => {
    const since = await lastSeq()
    // Telegram sends `managed_bot` again; Zumda fetches the new token by itself.
    await managedBotUpdate(OWNER, BOT_ID)
    const hook = await waitForCall("setWebhook", managedBotToken(BOT_ID, 2), since)
    expect(hook.body["url"]).toBe(`http://localhost:8787/tg/${BOT_ID}`)
})

test("a new owner of the bot alerts the admins; the shop stays put", async () => {
    const since = await lastSeq()
    await managedBotUpdate(PEOPLE.stranger, BOT_ID)
    await waitForMessage(PEOPLE.admin.id, "egasi o'zgardi", since)
    const [shop] = await myShops(OWNER)
    expect(shop?.name).toBe("Kamola Somsa")
    expect(await myShops(PEOPLE.stranger)).toHaveLength(0)
})

test("older Telegram: «Bot yaratish» opens the t.me/newbot link; the app notices the bot", async ({
    page,
}) => {
    const app = await openApp(page, { user: LINK_OWNER, businessBot: true })
    await describeBusiness(page, "Ulug'bek Choyxona")
    await bottomButton(page).click() // «Bot yaratish»
    await expect
        .poll(async () => (await app.calls()).find((c) => c.method === "openTelegramLink"))
        .toBeTruthy()
    const link = (await app.calls()).find((c) => c.method === "openTelegramLink")?.args[0]
    expect(link).toBe(
        "https://t.me/newbot/zumda_biznes_dev_bot/ulugbek_choyxona_bot?name=Ulug%27bek+Choyxona",
    )
    // The owner creates it in Telegram and comes back.
    await managedBotUpdate(LINK_OWNER, LINK_BOT_ID)
    await expect(page.getByText(`Bot yaratildi: @${newBotUsername(LINK_BOT_ID)}`)).toBeVisible({
        timeout: 15_000,
    })
    await finishApplication(page)
    expect((await myShops(LINK_OWNER))[0]?.botUsername).toBe(newBotUsername(LINK_BOT_ID))
})
