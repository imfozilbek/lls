/**
 * A crash in the Mini App reaches the server log and the admins, and tells nothing about the
 * person: no phone, no name, no token (owner's decision: logs and errors first).
 */
import { readFileSync } from "node:fs"

import { expect, test } from "@playwright/test"

import { WORKER_LOG } from "../stand/config.js"
import { pngImage } from "../support/images.js"
import { FOOD, PEOPLE, apiAs, resetStand } from "../support/stand.js"
import { lastSeq, messagesTo, waitForMessage } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.beforeAll(resetStand)

const PHONE = "+998901234567"
const NAME = "Азиз Каримов"

/** The server's `client_error` lines so far. */
function crashLines(): string[] {
    return readFileSync(WORKER_LOG, "utf8")
        .split("\n")
        .filter((line) => line.includes('"event":"client_error"'))
}

/** An uncaught error thrown outside any handler, as a real bug would. */
async function crash(page: Page, message: string): Promise<void> {
    await page.evaluate((text) => {
        setTimeout(() => {
            throw new TypeError(text)
        }, 0)
    }, message)
}

test("a crash reaches the log and the admins once, without the person in it", async ({ page }) => {
    const since = await lastSeq()
    const logged = crashLines().length
    const reports: string[] = []
    page.on("request", (request) => {
        if (request.url().endsWith("/api/client-errors")) {
            reports.push(request.postData() ?? "")
        }
    })
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()

    const message = `Cannot read 'total' for ${NAME} ${PHONE}`
    await crash(page, message)
    const alert = await waitForMessage(PEOPLE.admin.id, "ilovasida xato", since)
    expect(alert.text).toContain("TypeError: Cannot read 'total' for")
    expect(alert.text).toContain("shop:menu")

    await expect.poll(() => crashLines().length).toBe(logged + 1)
    const line = crashLines().at(-1) ?? ""
    expect(line).toContain('"screen":"shop:menu"')
    // The same crash again: no second request, no second alert.
    await crash(page, message)
    await page.waitForTimeout(500)
    expect(reports).toHaveLength(1)

    for (const secret of [PHONE, "998901234567", "Азиз", "Каримов", "auth_date", "hash="]) {
        expect(reports[0]).not.toContain(secret)
        expect(line).not.toContain(secret)
        expect(alert.text).not.toContain(secret)
    }
    const alerts = (await messagesTo(PEOPLE.admin.id, since)).filter((m) => m.text.includes("🚨"))
    expect(alerts).toHaveLength(1)
})

test("a logo whose file is gone: the shop's letter instead, and the server hears it once", async ({
    page,
}) => {
    const uploaded = await apiAs(PEOPLE.foodOwner, "/owner/shop/logo", {
        shop: FOOD,
        method: "PUT",
        png: pngImage(64),
    })
    expect(uploaded.status).toBe(200)
    // The file is gone from storage (as on 6 October 2026), the database still names it.
    await page.route("**/logo/**", (route) => route.fulfill({ status: 404, body: "" }))
    const logged = crashLines().length
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    await expect(page.locator('img[src*="/logo/"]')).toHaveCount(0)
    // Logged and sent to the admins (one alert of a kind per 10 minutes: the crash above took it).
    await expect.poll(() => crashLines().length).toBe(logged + 1)
    const line = crashLines().at(-1) ?? ""
    expect(line).toContain('"name":"ImageMissing"')
    expect(line).toContain('"detail":"logo"')
    expect(line).not.toContain("/logo/")
})
