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

    // One business: straight into it.
    await signInButton(page).click()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await expect(page.getByText("To'y oshi")).toBeVisible()
    // No Telegram BackButton in a browser: the app's own «Orqaga».
    await page.getByRole("button", { name: "Orqaga" }).click()
    await expect(page.getByRole("heading", { name: "Mening bizneslarim" })).toBeVisible()
    // A new business is a quiet button under the list, not the main one.
    await expect(page.getByRole("button", { name: "Yangi biznes" })).toBeVisible()
    await expect(bottomButton(page)).toBeHidden()

    // The sign-in survives a reload; «Chiqish» ends it.
    await page.reload()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    await page.getByRole("button", { name: "Orqaga" }).click()
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
    // One business: straight into it.
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
})

test("«Platforma» in a browser: its own Telegram Login, admins only, apart from Business", async ({
    page,
}) => {
    const next = { answer: { user: PEOPLE.foodOwner } as LoginAnswer }
    await page.route("https://telegram.org/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
    )
    await stubTelegramLogin(page, () => next.answer)
    await page.goto(`${APP_URL}/?mode=admin`)
    await expect(page.getByRole("heading", { name: "Zumda | Platforma" })).toBeVisible()

    // An owner may sign in to Zumda | Platforma, but «Platforma» stays closed to them.
    await signInButton(page).click()
    await expect(page.getByText("Bu bo'lim faqat Zumda jamoasi uchun")).toBeVisible()
    await page.evaluate(() => window.localStorage.clear())

    next.answer = { user: PEOPLE.admin }
    await page.reload()
    await signInButton(page).click()
    await expect(page.getByRole("heading", { name: "Platforma" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Arizalar" })).toBeVisible()
    // The sign-in survives a reload and is not one of Zumda | Business.
    await page.reload()
    await expect(page.getByRole("tab", { name: "Arizalar" })).toBeVisible()
    await page.goto(`${APP_URL}/?mode=business`)
    await expect(page.getByRole("heading", { name: "Zumda Business" })).toBeVisible()

    await page.goto(`${APP_URL}/?mode=admin`)
    await page.getByRole("button", { name: "Chiqish" }).click()
    await expect(page.getByRole("heading", { name: "Zumda | Platforma" })).toBeVisible()
})
