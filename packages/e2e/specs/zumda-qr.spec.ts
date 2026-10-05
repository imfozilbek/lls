/**
 * Goal 16: a shop's poster may carry a Zumda Shop QR. Scanned, it opens Zumda | Shop right on
 * that shop, inside the showcase (Back leads to the other shops), and an order through it is a
 * showcase order. A shop that left the showcase sends the person to its own bot.
 */
import { expect, test } from "@playwright/test"
import jsQR from "jsqr"
import { PNG } from "pngjs"

import { FOOD, PEOPLE, WATER, apiAs, resetStand } from "../support/stand.js"
import { callsOf, lastSeq, platformChat } from "../support/telegram.js"
import { openApp, openSettings } from "../support/webapp.js"

import type { RecordedFile } from "../stand/fake-telegram.js"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("the owner prints a Zumda Shop QR; its code opens Zumda Shop on the shop", async ({
    page,
}) => {
    const since = await lastSeq()
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Havola, QR-kod va vitrina")
    await expect(page.getByText("do'koningizni Zumda Shop'da ochadi")).toBeVisible()
    await page.getByRole("button", { name: "Zumda Shop uchun" }).click()
    await expect(page.getByRole("dialog", { name: "QR-kod tayyor" })).toBeVisible()

    const sent = (await callsOf("sendDocument", since)).filter(
        (c) => Number(c.body["chat_id"]) === PEOPLE.foodOwner.id,
    )
    expect(String(sent.at(-1)?.body["caption"])).toContain("Zumda Shop uchun QR-kod")
    const file = sent.at(-1)?.body["document"] as RecordedFile
    expect(file.name).toBe(`${FOOD}-zumda-qr.png`)
    const png = PNG.sync.read(Buffer.from(file.base64, "base64"))
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    expect(code?.data).toBe(`https://t.me/zumda_dev_bot?startapp=m_${FOOD}`)
})

test("a shop outside the showcase cannot print it yet", async ({ page }) => {
    await openApp(page, { user: PEOPLE.waterOwner, shop: WATER })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Havola, QR-kod va vitrina")
    await expect(page.getByRole("button", { name: "Zumda Shop uchun" })).toBeDisabled()
    await expect(page.getByText("Zumda vitrinasiga qo'shilgach ishlaydi")).toBeVisible()
    await expect(page.getByRole("button", { name: "Do'kon boti uchun" })).toBeEnabled()
})

test("scanned: Zumda Shop opens on the shop, Back shows the others, the order is a showcase one", async ({
    page,
}) => {
    // Zumda | Shop's main Mini App: no ?mode=market, only the signed startapp value.
    const app = await openApp(page, { user: PEOPLE.customer, startParam: `m_${FOOD}` })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Mening do'konim" })).toBeHidden()
    // The same signed entry orders through the showcase (channel decided by the signing bot);
    // the phone goes to Zumda | Shop first, as Telegram would send it.
    await platformChat().shareContact(PEOPLE.customer, "+998901234567")
    const placed = await apiAs(PEOPLE.customer, "/orders", {
        shop: FOOD,
        via: "marketplace",
        method: "POST",
        json: { items: [{ productId: "dev-food-p1", quantity: 1 }], address: "Navoiy 7" },
    })
    expect(placed.status).toBe(201)
    expect(await placed.json()).toMatchObject({ channel: "marketplace" })
    await app.back()
    await expect(page.getByRole("heading", { name: "Tumaningiz do'konlari" })).toBeVisible()
})

test("scanned after the shop left the showcase: its own bot instead", async ({ page }) => {
    const app = await openApp(page, { user: PEOPLE.customer, startParam: `m_${WATER}` })
    await expect(page.getByText("Bu do'kon hozir Zumda vitrinasida yo'q")).toBeVisible()
    await page.getByRole("button", { name: "Do'kon botini ochish" }).click()
    const link = (await app.calls()).filter((c) => c.method === "openTelegramLink").at(-1)
    expect(link?.args[0]).toBe("https://t.me/toza_suv_dev_bot")
    await page.getByRole("button", { name: "Boshqa do'konlar" }).click()
    await expect(page.getByRole("heading", { name: "Tumaningiz do'konlari" })).toBeVisible()
})
