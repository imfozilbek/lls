/**
 * The storefront's look (owner's decisions, November 2026; goal 24): the shop picks one of four
 * layouts in «Sozlamalar» → «Vitrina qanday ko'rinadi», puts a wide cover over it and looks at it
 * as customers do; the shelves lead with «Yangi kelganlar» while the shop has news.
 */
import { expect, test } from "@playwright/test"

import { runSql } from "../stand/seed.js"
import { pngImage } from "../support/images.js"
import { PEOPLE, STORE, resetStand } from "../support/stand.js"
import { openApp, openSettings, settingsBack } from "../support/webapp.js"

import type { Locator, Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const layout = (page: Page, name: string): Locator =>
    page.getByRole("radio", { name: new RegExp(`^${name}`) })

async function lookSettings(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.storeOwner, shop: STORE })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Vitrina qanday ko'rinadi")
}

async function pickLayout(page: Page, name: string): Promise<void> {
    await layout(page, name).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    await expect(layout(page, name)).toHaveAttribute("aria-checked", "true")
}

test("never chosen, the photos decide; the owner picks the shelves", async ({ page }) => {
    await lookSettings(page)
    // The sample has no photos: customers see a list now, and the picker says so.
    await expect(layout(page, "Ro'yxat ko'rinishida")).toHaveAttribute("aria-checked", "true")
    await expect(layout(page, "Ikki ustunda")).toHaveAttribute("aria-checked", "false")
    await pickLayout(page, "Bo'limlarga ajratilgan")
    // The list of parts names the look chosen.
    await settingsBack(page)
    await expect(page.getByText("Bo'limlarga ajratilgan")).toBeVisible()
})

test("customers see the shelves, the news first; «Hammasi» shows a category in two columns", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: STORE })
    const shelves = page.locator("main section[aria-label]")
    // Every sample product was just added: the news lead, then the fullest category.
    await expect(shelves.first()).toHaveAttribute("aria-label", "Yangi kelganlar")
    await expect(shelves.nth(1)).toHaveAttribute("aria-label", "Maishiy kimyo")
    // A product stands on every shelf of its own, anchored once.
    await expect(page.locator('[id="product-dev-store-p1"]')).toHaveCount(1)

    await page.getByRole("button", { name: "Hammasi: Elektr mollari" }).click()
    await expect(page.getByRole("button", { name: "Elektr mollari", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(page.getByRole("heading", { name: "LED lampochka" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Chinni choynak" })).toBeHidden()
    await expect(shelves).toHaveCount(0)

    // «Hammasini ko'rish»: every new product, under its own tab.
    await page.getByRole("button", { name: "Hammasi", exact: true }).click()
    await page.getByRole("button", { name: "Hammasini ko'rish: Yangi kelganlar" }).click()
    await expect(
        page.getByRole("button", { name: "Yangi kelganlar", exact: true }),
    ).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("heading", { name: "Chinni choynak" })).toBeVisible()
})

test("two new products are no news: the shelves start with the categories", async ({ page }) => {
    runSql(
        `UPDATE products SET created_at = 0 WHERE business_id = 'dev-store'
         AND id NOT IN ('dev-store-p1', 'dev-store-p2')`,
    )
    await openApp(page, { user: PEOPLE.customer, shop: STORE })
    await expect(page.getByRole("region", { name: "Maishiy kimyo" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Yangi kelganlar" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Yangi kelganlar", exact: true })).toHaveCount(0)
})

test("a big photo a row, and two columns, when the owner says so", async ({ page }) => {
    await lookSettings(page)
    await pickLayout(page, "Katta rasm bilan")
    await openApp(page, { user: PEOPLE.customer, shop: STORE })
    // One product a row: its description is there in full.
    await expect(page.getByText("E27 patron, iliq yoki oq nur.")).toBeVisible()
    await expect(page.locator("main article")).toHaveCount(6)

    await lookSettings(page)
    await pickLayout(page, "Ikki ustunda")
    await openApp(page, { user: PEOPLE.customer, shop: STORE })
    await expect(page.locator("main article")).toHaveCount(6)
    // Two columns: the second card stands beside the first, in the same row (they rise in
    // one after another, so their tops may still differ by a pixel).
    const first = await page.locator("main article").nth(0).boundingBox()
    const second = await page.locator("main article").nth(1).boundingBox()
    expect(second?.x ?? 0).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0) / 2)
    expect(second?.y ?? 0).toBeLessThan((first?.y ?? 0) + (first?.height ?? 0) / 2)
})

test("a cover over the storefront, changed and taken away; «Mijozlar shunday ko'radi»", async ({
    page,
}) => {
    await lookSettings(page)
    await page.locator('input[type="file"]').setInputFiles({
        name: "muqova.png",
        mimeType: "image/png",
        buffer: pngImage(400, [190, 24, 93]),
    })
    await expect(page.getByText("Saqlandi")).toBeVisible()
    await expect(page.getByRole("button", { name: "Boshqa rasm qo'yish" })).toBeVisible()

    // The storefront itself, as customers see it; Back returns to the settings.
    await page.getByRole("button", { name: "Mijozlar shunday ko'radi" }).click()
    await expect(page.getByRole("heading", { name: "Uy Bozori" })).toBeVisible()
    await expect(page.locator('main header img[src*="/cover/"]')).toBeVisible()

    await openApp(page, { user: PEOPLE.customer, shop: STORE })
    await expect(page.locator('main header img[src*="/cover/"]')).toBeVisible()

    await lookSettings(page)
    // Asked once more («Muqova rasmini o'chirasizmi?»); the stand's Telegram says yes.
    await page.getByRole("button", { name: "Rasmni o'chirish" }).click()
    await expect(page.getByText("Muqova rasmi olib tashlandi")).toBeVisible()
    await expect(page.getByRole("button", { name: "Rasm qo'shish" })).toBeVisible()
    await openApp(page, { user: PEOPLE.customer, shop: STORE })
    await expect(page.getByRole("heading", { name: "Uy Bozori" })).toBeVisible()
    await expect(page.locator('main header img[src*="/cover/"]')).toHaveCount(0)
})
