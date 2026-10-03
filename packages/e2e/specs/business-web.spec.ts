/**
 * business.zumda.shop in a browser, outside Telegram: the owner signs in with the Telegram Login
 * Widget of Zumda | Business and manages their business like in the bot.
 */
import { expect, test } from "@playwright/test"

import { APP_URL } from "../stand/config.js"
import { PEOPLE, resetStand } from "../support/stand.js"
import { stubTelegramLogin } from "../support/telegram-login.js"
import { bottomButton } from "../support/webapp.js"

import type { LoginAnswer } from "../support/telegram-login.js"
import type { Page } from "@playwright/test"

/**
 * Opens the business address in a plain browser: no Telegram app, Telegram's login window
 * stubbed to answer with `next`.
 */
async function openInBrowser(page: Page, next: { answer: LoginAnswer }): Promise<void> {
    await page.route("https://telegram.org/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
    )
    await stubTelegramLogin(page, () => next.answer)
    await page.goto(`${APP_URL}/?mode=business`)
    await expect(page.getByRole("heading", { name: "Zumda Business" })).toBeVisible()
}

const signInButton = (page: Page): ReturnType<Page["getByRole"]> =>
    page.getByRole("button", { name: "Telegram orqali kirish" })

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("signs in with Telegram, manages the business, signs out", async ({ page }) => {
    const next = { answer: { user: PEOPLE.foodOwner } as LoginAnswer }
    await openInBrowser(page, next)
    await expect(page.getByText("Kirish faqat Telegram orqali")).toBeVisible()

    await signInButton(page).click()
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

test("a login Telegram did not sign, for another bot, or cancelled is refused", async ({
    page,
}) => {
    const next = { answer: { user: PEOPLE.foodOwner, foreignKey: true } as LoginAnswer }
    await openInBrowser(page, next)
    await signInButton(page).click()
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeHidden()

    next.answer = { user: PEOPLE.foodOwner, claims: { aud: "123456" } }
    await signInButton(page).click()
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeHidden()

    // The person closed Telegram's window.
    next.answer = { user: null }
    await signInButton(page).click()
    await expect(page.getByRole("alert")).toHaveText("Kirish yakunlanmadi. Qayta urinib ko'ring.")

    next.answer = { user: PEOPLE.foodOwner }
    await signInButton(page).click()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
})
