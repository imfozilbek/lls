/**
 * business.zumda.shop in a browser, outside Telegram: the owner signs in with the Telegram Login
 * Widget of Zumda | Business and manages their business like in the bot.
 */
import { createHash, createHmac } from "node:crypto"

import { expect, test } from "@playwright/test"

import { APP_URL, businessBot } from "../stand/config.js"
import { PEOPLE, resetStand } from "../support/stand.js"
import { bottomButton } from "../support/webapp.js"

import type { TgUser } from "../support/telegram.js"
import type { Page } from "@playwright/test"

/** What Telegram's widget hands the page for `user`, signed with the bot token. */
function widgetLogin(
    user: TgUser,
    botToken = businessBot().token,
): Record<string, string | number> {
    const fields: Record<string, string | number> = {
        id: user.id,
        first_name: user.first_name,
        auth_date: Math.floor(Date.now() / 1000),
    }
    const dataCheckString = Object.entries(fields)
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join("\n")
    const secret = createHash("sha256").update(botToken).digest()
    return { ...fields, hash: createHmac("sha256", secret).update(dataCheckString).digest("hex") }
}

/** Opens the business address in a plain browser: no Telegram, Telegram's widget blocked. */
async function openInBrowser(page: Page): Promise<void> {
    await page.route("https://telegram.org/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
    )
    await page.goto(`${APP_URL}/?mode=business`)
    await expect(page.getByRole("heading", { name: "Zumda Business" })).toBeVisible()
}

/** Telegram's widget calls the page back after the person confirms. */
async function signInWith(page: Page, login: Record<string, string | number>): Promise<void> {
    await page.evaluate((data) => {
        const callback = (window as unknown as Record<string, (d: unknown) => void>)[
            "__zumdaBusinessLogin"
        ]
        callback?.(data)
    }, login)
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("signs in with Telegram, manages the business, signs out", async ({ page }) => {
    await openInBrowser(page)
    await expect(page.getByRole("heading", { name: "Zumda Business" })).toBeVisible()
    await expect(page.getByText("Kirish faqat Telegram orqali")).toBeVisible()

    await signInWith(page, widgetLogin(PEOPLE.foodOwner))
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
    await page.getByRole("button", { name: /Osh Markaz/ }).click()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await expect(page.getByText("To'y oshi")).toBeVisible()
    // No Telegram BackButton in a browser: the app's own «Orqaga».
    await page.getByRole("button", { name: "Orqaga" }).click()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
    await expect(bottomButton(page)).toHaveText("Yangi biznes")

    // The sign-in survives a reload; «Chiqish» ends it.
    await page.reload()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
    await page.getByRole("button", { name: "Chiqish" }).click()
    await expect(page.getByRole("heading", { name: "Zumda Business" })).toBeVisible()
})

test("a login not signed by Zumda | Business is refused", async ({ page }) => {
    await openInBrowser(page)
    await signInWith(page, widgetLogin(PEOPLE.foodOwner, "123:not-the-business-bot-token-xx"))
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeHidden()
})
