/**
 * A shop bot made with «Bot yaratish» that its owner never opened may not write to them first:
 * the owner still gets the poster and the orders, through Zumda | Business with the note to press
 * Start; «Ishga tayyor» asks for it; after Start the shop's own bot writes again.
 */
import { expect, test } from "@playwright/test"
import jsQR from "jsqr"
import { PNG } from "pngjs"

import { WORKER_URL, businessBot, shopBySlug } from "../stand/config.js"
import { GROCERY, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { callsOf, controlTelegram, lastSeq, messagesTo, shopChat } from "../support/telegram.js"
import { openApp, openSettings } from "../support/webapp.js"

import type { RecordedFile } from "../stand/fake-telegram.js"
import type { Page } from "@playwright/test"

const OWNER = PEOPLE.groceryOwner
const SHOP_BOT = shopBySlug(GROCERY).bot

async function openOwner(page: Page): Promise<ReturnType<typeof openApp>> {
    const app = openApp(page, { user: OWNER, shop: GROCERY })
    await (await app).page.getByRole("button", { name: "Mening do'konim" }).click()
    return app
}

async function posterSheet(page: Page): Promise<ReturnType<Page["getByRole"]>> {
    await openSettings(page, "Havola, QR-kod va vitrina")
    await page.getByRole("button", { name: "Do'kon boti uchun" }).click()
    const sheet = page.getByRole("dialog", { name: "QR-kod tayyor" })
    await expect(sheet).toBeVisible()
    return sheet
}

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await resetStand()
    await controlTelegram({ notStarted: [`${SHOP_BOT.username}:${OWNER.id}`] })
})

test.afterAll(async () => {
    await controlTelegram({ notStarted: [] })
})

test("«Ishga tayyor» asks to open the bot; the poster comes through Zumda | Business and downloads", async ({
    page,
}) => {
    const app = await openOwner(page)
    const step = page.getByRole("button", { name: /Botingizni oching/ })
    await expect(step).toBeVisible()
    await step.click()
    const links = (await app.calls()).filter((c) => c.method === "openTelegramLink")
    expect(links.at(-1)?.args[0]).toBe(`https://t.me/${SHOP_BOT.username}?start=owner`)

    const since = await lastSeq()
    const sheet = await posterSheet(page)
    await expect(sheet.getByText("plakat Zumda Business'ga yuborildi")).toBeVisible()
    await expect(sheet.getByRole("img", { name: "QR-kodli plakat" })).toBeVisible()
    await page.screenshot({ path: "screenshots/light/poster-sheet.png" })

    // The shop's bot was refused; the file came from Zumda | Business, with the note and the
    // button to the shop's bot.
    const tries = (await callsOf("sendDocument", since)).filter(
        (c) => Number(c.body["chat_id"]) === OWNER.id,
    )
    expect(tries.map((c) => c.token)).toEqual([SHOP_BOT.token, businessBot().token])
    const sent = tries[1]
    expect(String(sent?.body["caption"])).toContain(`@${SHOP_BOT.username} sizga yoza olmadi`)
    expect(String(sent?.body["reply_markup"])).toContain(`?start=owner`)

    // «Yuklab olish»: Telegram's own save window gets the poster's file.
    await sheet.getByRole("button", { name: "Yuklab olish" }).click()
    const download = (await app.calls()).filter((c) => c.method === "downloadFile").at(-1)
    const params = download?.args[0] as { url: string; file_name: string }
    expect(params.file_name).toBe(`${GROCERY}-qr.png`)
    expect(params.url.startsWith(`${WORKER_URL}/img/`)).toBe(true)
    const file = await fetch(params.url)
    expect(file.headers.get("content-disposition")).toContain("attachment")
    const png = PNG.sync.read(Buffer.from(await file.arrayBuffer()))
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    expect(code?.data).toBe(`https://t.me/${SHOP_BOT.username}`)
    expect((sent?.body["document"] as RecordedFile).contentType).toBe("image/png")
})

test("a new order reaches the owner through Zumda | Business; admins see the bot cannot write", async () => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, GROCERY, [
        { productId: "dev-grocery-p1", quantity: 3000 },
    ])
    await expect
        .poll(async () =>
            (await messagesTo(OWNER.id, since)).some(
                (m) => m.text.includes("sizga yoza olmadi") && m.text.includes(`#${order.number}`),
            ),
        )
        .toBe(true)
    const shops = (await (
        await apiAs(PEOPLE.admin, "/admin/shops?status=active", { businessBot: true })
    ).json()) as { data: { slug: string; ownerChat: string }[] }
    expect(shops.data.find((s) => s.slug === GROCERY)?.ownerChat).toBe("closed")
})

test("after Start in the shop's bot the step ticks and the poster comes from the shop's bot", async ({
    page,
}) => {
    await controlTelegram({ notStarted: [] })
    const since = await lastSeq()
    await shopChat(GROCERY).send(OWNER, "/start owner")
    await expect
        .poll(async () =>
            (await messagesTo(OWNER.id, since)).some((m) =>
                m.text.includes("endi buyurtmalar va xabarlar shu yerga keladi"),
            ),
        )
        .toBe(true)

    await openOwner(page)
    await expect(page.getByRole("button", { name: /Botingizni oching/ })).toBeHidden()
    const after = await lastSeq()
    const sheet = await posterSheet(page)
    await expect(sheet.getByText("Plakat bot bilan chatga ham yuborildi")).toBeVisible()
    const tries = (await callsOf("sendDocument", after)).filter(
        (c) => Number(c.body["chat_id"]) === OWNER.id,
    )
    expect(tries.map((c) => c.token)).toEqual([SHOP_BOT.token])
})
