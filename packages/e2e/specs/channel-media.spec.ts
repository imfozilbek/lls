/**
 * A channel post with several photos or a video (owner's decision, November 2026): Telegram shows
 * no button under an album, so two to four photos go as one collage drawn in the app, and a video
 * goes on to Telegram with «Buyurtma berish» under it. Nothing is stored on our side.
 */
import { truncateSync, writeFileSync } from "node:fs"

import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, resetStand } from "../support/stand.js"
import { pngImage } from "../support/images.js"
import { callsOf, channelMembership, lastSeq } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { TgChannel } from "../support/telegram.js"
import type { Locator, Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })

const CHANNEL: TgChannel = { id: -1001234567892, title: "Osh Markaz media", username: "osh_media" }
const P1 = "dev-food-p1"
const VIDEO = Buffer.alloc(200_000, 7)

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

/** The owner's «Kanalga joylash» sheet of the product. */
async function postSheet(page: Page): Promise<Locator> {
    const name = await productName(P1)
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click()
    await page.getByRole("button", { name: "Kanalga joylash" }).click()
    const sheet = page.getByRole("dialog", { name: "Kanalga joylash" })
    await expect(sheet.getByRole("region", { name: "Rasmlar va video" })).toBeVisible()
    return sheet
}

function photo(
    name: string,
    rgb: [number, number, number],
): {
    name: string
    mimeType: string
    buffer: Buffer
} {
    return { name, mimeType: "image/png", buffer: pngImage(400, rgb) }
}

test("two to four photos from the phone go as one collage with the button", async ({ page }) => {
    const sheet = await postSheet(page)
    const photos = sheet.locator('input[type="file"][accept="image/*"]')
    await photos.setInputFiles([photo("a.png", [217, 119, 6]), photo("b.png", [21, 128, 61])])
    const media = sheet.getByRole("region", { name: "Rasmlar va video" })
    await expect(media.getByRole("button", { name: "Olib tashlash" })).toHaveCount(2)
    await expect(sheet.getByText("bitta rasmga yig'iladi")).toBeVisible()
    await sheet.getByRole("tab", { name: "Ustma-ust" }).click()
    await photos.setInputFiles([photo("c.png", [37, 99, 235])])
    // Three photos: one large and two small, no other layout to pick.
    await expect(media.getByRole("button", { name: "Olib tashlash" })).toHaveCount(3)
    await expect(sheet.getByRole("tab", { name: "Ustma-ust" })).toHaveCount(0)
    await page.waitForTimeout(400) // entry animations, for the screenshot
    await page.screenshot({ path: "screenshots/channel-post-collage.png" })

    const since = await lastSeq()
    await sheet.getByRole("button", { name: "Joylash", exact: true }).click()
    await expect(page.getByText("Post kanalga joylandi")).toBeVisible()
    const [sent] = (await callsOf("sendPhoto", since)).filter(
        (call) => Number(call.body["chat_id"]) === CHANNEL.id,
    )
    const picture = sent?.body["photo"] as { contentType: string; size: number } | undefined
    expect(picture?.contentType).toBe("image/jpeg")
    expect(picture?.size).toBeGreaterThan(0)
    const keyboard = JSON.parse(String(sent?.body["reply_markup"])) as Keyboard
    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe("🛒 Buyurtma berish")
})

test("a video goes on to the channel with the button; a new price edits its caption", async ({
    page,
}) => {
    const sheet = await postSheet(page)
    await sheet
        .locator('input[type="file"][accept^="video/"]')
        .setInputFiles({ name: "clip.mp4", mimeType: "video/mp4", buffer: VIDEO })
    await expect(sheet.getByText("Video bilan faqat video joylanadi")).toBeVisible()
    await expect(sheet.getByRole("button", { name: "Rasm qo'shish" })).toHaveCount(0)
    await page.screenshot({ path: "screenshots/channel-post-video.png" })

    const since = await lastSeq()
    await sheet.getByRole("button", { name: "Joylash", exact: true }).click()
    await expect(page.getByText("Post kanalga joylandi")).toBeVisible()
    const [sent] = (await callsOf("sendVideo", since)).filter(
        (call) => Number(call.body["chat_id"]) === CHANNEL.id,
    )
    const video = sent?.body["video"] as { contentType: string; size: number } | undefined
    expect(video).toMatchObject({ contentType: "video/mp4", size: VIDEO.byteLength })
    const keyboard = JSON.parse(String(sent?.body["reply_markup"])) as Keyboard
    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe("🛒 Buyurtma berish")

    const priced = await lastSeq()
    const changed = await apiAs(PEOPLE.foodOwner, `/owner/products/${P1}`, {
        shop: FOOD,
        method: "PATCH",
        json: { price: 47_000 },
    })
    expect(changed.status).toBe(200)
    await expect
        .poll(async () => (await callsOf("editMessageCaption", priced)).length)
        .toBeGreaterThan(0)
    expect(await callsOf("editMessageText", priced)).toHaveLength(0)
})

test("a video Telegram does not show, or one over 50 MB, is refused before it is sent", async ({
    page,
}, testInfo) => {
    const sheet = await postSheet(page)
    const input = sheet.locator('input[type="file"][accept^="video/"]')
    await input.setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: VIDEO })
    await expect(page.getByText("Bu video turi to'g'ri kelmaydi")).toBeVisible()

    const since = await lastSeq()
    // Over Playwright's in-memory limit too: a file on disk, empty space and no bytes written.
    const big = testInfo.outputPath("big.mp4")
    writeFileSync(big, "")
    truncateSync(big, 50 * 1024 * 1024 + 1)
    await input.setInputFiles(big)
    await sheet.getByRole("button", { name: "Joylash", exact: true }).click()
    await expect(page.getByText("Video 50 MB dan katta")).toBeVisible()
    expect(await callsOf("sendVideo", since)).toHaveLength(0)
})
