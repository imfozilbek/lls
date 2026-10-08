/**
 * Not a test: films the sign-up of each role on the stand for the bots' greeting videos
 * (`brand/welcome/video/build.sh` copies it into `packages/e2e/specs/` for one run, then removes it).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, resetStand } from "../support/stand.js"
import {
    businessChat,
    courierChat,
    lastSeq,
    messagesTo,
    platformChat,
    shopChat,
    waitForMessage,
} from "../support/telegram.js"
import { bottomButton, openApp, openGroup } from "../support/webapp.js"

import type { BotMessage, TgUser } from "../support/telegram.js"
import type { Locator, Page } from "@playwright/test"

const OUT = process.env["REEL_DIR"] ?? "reel"
const SHOTS = join(OUT, "shots")
mkdirSync(SHOTS, { recursive: true })

interface Frame {
    file: string
    tap?: { x: number; y: number; w: number; h: number }
}
const film: Record<string, Frame[]> = {}
const chats: Record<string, BotMessage[]> = {}
let current: Frame[] = []
let count = 0

test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
})
test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)
test.afterAll(() => {
    // Takes add to the film already shot: a single test can be filmed again.
    const path = join(OUT, "film.json")
    const before = existsSync(path)
        ? (JSON.parse(readFileSync(path, "utf8")) as { film: typeof film; chats: typeof chats })
        : { film: {}, chats: {} }
    const merged = { film: { ...before.film, ...film }, chats: { ...before.chats, ...chats } }
    writeFileSync(path, JSON.stringify(merged, null, 2))
})
let prefix = ""

/** A role's frames; `shotPrefix` numbers them apart (the showcase: `m001-…`). */
function role(name: string, shotPrefix = ""): void {
    current = []
    film[name] = current
    if (shotPrefix) {
        prefix = shotPrefix
        count = 0
    }
}

/** The stand's technical names read as the real ones would. */
const RENAME: [string, string][] = [
    ["new_777300400_bot", "dilnoza_somsa_bot"],
    ["zumda_kuryer_dev_bot", "zumdashop_kuryer_bot"],
]

async function snap(page: Page, name: string, wait = 600): Promise<void> {
    await page.waitForTimeout(wait)
    await page.evaluate((pairs) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            for (const [from, to] of pairs) {
                if (node.nodeValue?.includes(from)) {
                    node.nodeValue = node.nodeValue.replaceAll(from, to)
                }
            }
        }
    }, RENAME)
    count += 1
    const file = `${prefix}${String(count).padStart(3, "0")}-${name}.png`
    await page.screenshot({ path: join(SHOTS, file) })
    current.push({ file })
}

/** Remembers where the finger goes on the last frame, then presses. */
async function tap(target: Locator): Promise<void> {
    await target.scrollIntoViewIfNeeded()
    const box = await target.boundingBox()
    const last = current.at(-1)
    if (box && last) {
        last.tap = {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
            w: box.width,
            h: box.height,
        }
    }
    await target.click()
}

async function typeIn(page: Page, field: Locator, text: string, name: string): Promise<void> {
    await tap(field)
    const parts = [Math.ceil(text.length / 3), Math.ceil((text.length * 2) / 3), text.length]
    for (const end of parts) {
        await field.fill(text.slice(0, end))
        await snap(page, name, 150)
    }
}

const OWNER: TgUser = { id: 4301, first_name: "Dilnoza", language_code: "uz" }
const COURIER: TgUser = { id: 4302, first_name: "Bobur", language_code: "uz" }
const CUSTOMER: TgUser = { id: 4303, first_name: "Malika", language_code: "uz" }
const BOT_ID = 777300400

test("biznes egasi", async ({ page }) => {
    role("owner")
    const since = await lastSeq()
    await businessChat().send(OWNER, "/start")
    await waitForMessage(OWNER.id, "", since)
    chats["ownerStart"] = await messagesTo(OWNER.id, since)

    await openApp(page, { user: OWNER, businessBot: true, version: "9.6", createsBot: BOT_ID })
    await snap(page, "owner-intro", 1200)
    await tap(bottomButton(page))
    await snap(page, "owner-step1")
    await typeIn(page, page.getByLabel("Biznes nomi"), "Dilnoza Somsa", "owner-name")
    await tap(page.getByRole("radio", { name: "Restoran" }))
    await snap(page, "owner-kind")
    await tap(bottomButton(page))
    await expect(page.getByText("2/3-qadam")).toBeVisible()
    await snap(page, "owner-step2")
    await tap(bottomButton(page))
    await expect(page.getByText(/Bot yaratildi/)).toBeVisible()
    await snap(page, "owner-bot-made")
    await tap(bottomButton(page))
    await snap(page, "owner-step3")
    await tap(page.getByRole("button", { name: "Xaritada belgilash" }))
    const picker = page.locator("[role=dialog][data-point]")
    await expect(picker.locator(".zumda-map")).toHaveAttribute("data-map-ready", "true", {
        timeout: 20_000,
    })
    await snap(page, "owner-map", 1500)
    await tap(picker.getByRole("button", { name: "Joylashuvim" }))
    await expect(picker).toHaveAttribute("data-point", "38.9785,66.6831")
    await snap(page, "owner-map-here", 1500)
    await tap(picker.getByRole("button", { name: "Shu yer" }))
    await expect(picker).toBeHidden()
    await snap(page, "owner-place")
    const address = page.getByRole("textbox", { name: /Manzil/ })
    if ((await address.count()) > 0 && (await address.inputValue()) === "") {
        await typeIn(page, address, "Yakkabog', Mustaqillik 12", "owner-address")
    }
    await tap(bottomButton(page))
    await expect(page.getByRole("region", { name: "Ishga tayyor" })).toBeVisible()
    await snap(page, "owner-ready", 1000)

    const card = await waitForMessage(PEOPLE.admin.id, "Dilnoza Somsa", since)
    const approved = await lastSeq()
    await businessChat().press(PEOPLE.admin, card.buttons[0]?.callback_data ?? "")
    await waitForMessage(OWNER.id, "ishga tushdi", approved)
    chats["ownerApproved"] = await messagesTo(OWNER.id, approved)
    chats["ownerAll"] = await messagesTo(OWNER.id, since)
})

test("kuryer", async ({ page }) => {
    role("courier")
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    await openGroup(page, "Kuryerlar")
    await snap(page, "courier-owner-list")
    await tap(page.getByRole("button", { name: "Kuryerni taklif qilish" }))
    await snap(page, "courier-owner-invite", 1000)
    const html = await page.content()
    const code = /start=(c_[A-Za-z0-9_-]+)/.exec(html)?.[1]
    expect(code).toBeTruthy()

    const since = await lastSeq()
    await courierChat().send(COURIER, `/start ${code ?? ""}`)
    await waitForMessage(COURIER.id, "telefon", since)
    chats["courierInvite"] = await messagesTo(COURIER.id, since)
    const shared = await lastSeq()
    await courierChat().shareContact(COURIER, "+998907776655")
    await waitForMessage(COURIER.id, /raqamingiz/i, shared)
    chats["courierPhone"] = await messagesTo(COURIER.id, shared)

    const ask = (await messagesTo(PEOPLE.foodOwner.id, since)).findLast((m) =>
        m.text.includes("Bobur"),
    )
    chats["courierOwnerAsk"] = ask ? [ask] : []
    const approved = await lastSeq()
    await shopChat(FOOD).press(PEOPLE.foodOwner, ask?.buttons[0]?.callback_data ?? "", 1)
    await waitForMessage(COURIER.id, "tasdiqladi", approved)
    chats["courierApproved"] = await messagesTo(COURIER.id, approved)

    await openApp(page, { user: COURIER, courierBot: true })
    await snap(page, "courier-home", 1500)
    const shift = page.getByRole("switch", { name: "Smenadaman" })
    await tap(shift)
    await expect(shift).toBeChecked()
    await snap(page, "courier-on-shift", 1000)
})

test("mijoz", async ({ page }) => {
    role("customer")
    const since = await lastSeq()
    await shopChat(FOOD).send(CUSTOMER, "/start")
    await page.waitForTimeout(1500)
    chats["customerStart"] = await messagesTo(CUSTOMER.id, since)

    await openApp(page, { user: CUSTOMER, shop: FOOD, phone: "+998935551122" })
    await snap(page, "customer-shop", 1500)
    await tap(page.getByRole("button", { name: "Qo'shish: To'y oshi" }))
    await snap(page, "customer-added")
    await tap(bottomButton(page))
    await snap(page, "customer-cart")
    await tap(bottomButton(page))
    await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()
    await snap(page, "customer-checkout")
    await tap(page.getByRole("button", { name: "Raqamni yuborish" }))
    await expect(page.getByText("+998 93 555 11 22")).toBeVisible({ timeout: 20_000 })
    await snap(page, "customer-phone")
    await typeIn(
        page,
        page.getByRole("textbox", { name: "Manzil" }),
        "Mustaqillik 5",
        "customer-address",
    )
    await typeIn(page, page.getByLabel("Mo'ljal"), "maktab yonida", "customer-landmark")
    await tap(page.getByRole("button", { name: "Xaritada belgilash" }))
    const picker = page.locator("[role=dialog][data-point]")
    await expect(picker.locator(".zumda-map")).toHaveAttribute("data-map-ready", "true", {
        timeout: 20_000,
    })
    await snap(page, "customer-map", 1500)
    await tap(picker.getByRole("button", { name: "Joylashuvim" }))
    await expect(picker).toHaveAttribute("data-point", "38.9785,66.6831")
    await snap(page, "customer-map-here", 1500)
    await tap(picker.getByRole("button", { name: "Shu yer" }))
    await expect(picker).toBeHidden()
    await snap(page, "customer-ready")
    await tap(bottomButton(page))
    await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toBeVisible()
    await snap(page, "customer-sent", 1200)
})

test("mijoz vitrinada", async ({ page }) => {
    role("showcase", "m")
    const buyer: TgUser = { id: 4304, first_name: "Malika", language_code: "uz" }
    const since = await lastSeq()
    await platformChat().send(buyer, "/start")
    await waitForMessage(buyer.id, "", since)
    chats["showcaseStart"] = await messagesTo(buyer.id, since)

    await openApp(page, { user: buyer, query: "?mode=market", phone: "+998935551122" })
    await expect(page.getByRole("heading", { name: "Tumaningiz do'konlari" })).toBeVisible()
    await snap(page, "market", 1500)
    await tap(page.getByRole("button", { name: /Osh Markaz/ }))
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    await snap(page, "market-shop", 1500)
    await tap(page.getByRole("button", { name: "Qo'shish: To'y oshi" }))
    await snap(page, "market-added")
    await tap(bottomButton(page))
    await snap(page, "market-cart")
    await tap(bottomButton(page))
    await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()
    await snap(page, "market-checkout")
    await tap(page.getByRole("button", { name: "Raqamni yuborish" }))
    await expect(page.getByText("+998 93 555 11 22")).toBeVisible({ timeout: 20_000 })
    await snap(page, "market-phone")
    await typeIn(
        page,
        page.getByRole("textbox", { name: "Manzil" }),
        "Mustaqillik 5",
        "market-address",
    )
    await typeIn(page, page.getByLabel("Mo'ljal"), "maktab yonida", "market-landmark")
    await tap(page.getByRole("button", { name: "Xaritada belgilash" }))
    const picker = page.locator("[role=dialog][data-point]")
    await expect(picker.locator(".zumda-map")).toHaveAttribute("data-map-ready", "true", {
        timeout: 20_000,
    })
    await snap(page, "market-map", 1500)
    await tap(picker.getByRole("button", { name: "Joylashuvim" }))
    await expect(picker).toHaveAttribute("data-point", "38.9785,66.6831")
    await snap(page, "market-map-here", 1500)
    await tap(picker.getByRole("button", { name: "Shu yer" }))
    await expect(picker).toBeHidden()
    await snap(page, "market-ready")
    await tap(bottomButton(page))
    await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toBeVisible()
    await snap(page, "market-sent", 1200)
})
