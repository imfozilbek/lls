/**
 * Goal 17: «Ro'yxat bilan qo'shish». The owner pastes a list, one product a line; the good lines
 * are added at once, a wrong one stays in the box, marked; the same list again adds no twins.
 */
import { expect, test } from "@playwright/test"

import { GROCERY, PEOPLE, apiAs, resetStand } from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const LIST = Array.from({ length: 50 }, (_, i) => `Tovar-${i + 1} ${1000 + i * 10}`)

async function names(): Promise<string[]> {
    const response = await apiAs(PEOPLE.groceryOwner, "/owner/products?limit=100", {
        shop: GROCERY,
    })
    return ((await response.json()) as { data: { name: string }[] }).data.map((p) => p.name)
}

async function openBulk(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Katalog" }).click()
    await page.getByRole("button", { name: "Ro'yxat bilan qo'shish" }).click()
    await expect(page.getByRole("heading", { name: "Ro'yxat bilan qo'shish" })).toBeVisible()
}

test("50 lines at once; a line without a price stays in the box, marked", async ({ page }) => {
    await openBulk(page)
    const box = page.getByLabel("Ro'yxat bilan qo'shish")
    await box.fill([...LIST.slice(0, 25), "Qovun", ...LIST.slice(25)].join("\n"))
    await expect(page.getByText("Tayyor: 50 ta")).toBeVisible()
    await expect(page.getByText("Narxini yozing: «Qovun 5000»")).toBeVisible()
    await expect(bottomButton(page)).toHaveText("50 ta mahsulotni qo'shish")
    await bottomButton(page).click()
    await expect(page.getByText("50 ta mahsulot qo'shildi")).toBeVisible()
    // Only the wrong line is left to fix.
    await expect(box).toHaveValue("Qovun")

    const saved = await names()
    expect(saved.filter((name) => name.startsWith("Tovar-"))).toHaveLength(50)
    expect(saved).not.toContain("Qovun")
})

test("the same list again adds no twins", async ({ page }) => {
    await openBulk(page)
    await page.getByLabel("Ro'yxat bilan qo'shish").fill(LIST.slice(0, 3).join("\n"))
    await bottomButton(page).click()
    await expect(page.getByText("3 tasi do'konda bor edi")).toBeVisible()
    expect((await names()).filter((name) => name.startsWith("Tovar-"))).toHaveLength(50)
})

test("the entry is also in the product form, next to the catalog search", async ({ page }) => {
    await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Katalog" }).click()
    await bottomButton(page).click() // «Mahsulot qo'shish»
    await page.getByRole("button", { name: "Ro'yxat bilan", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Ro'yxat bilan qo'shish" })).toBeVisible()
})
