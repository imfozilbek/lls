/**
 * Up to three photos of a product (owner's decision, November 2026): the owner adds them in the
 * form, makes any of them the main one, takes one away; the customer swipes through them in the
 * product's sheet, the menu shows the main one.
 */
import { expect, test } from "@playwright/test"

import { pngImage } from "../support/images.js"
import { FOOD, PEOPLE, apiAs, resetStand } from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const OSH = "dev-food-p1"

async function photos(): Promise<string[]> {
    const page = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/products", { shop: FOOD })
    ).json()) as { data: { id: string; imageKey?: string; moreImageKeys?: string[] }[] }
    const osh = page.data.find((p) => p.id === OSH)
    return osh?.imageKey ? [osh.imageKey, ...(osh.moreImageKeys ?? [])] : []
}

async function openOsh(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await page.getByRole("button", { name: /^To'y oshi/ }).click()
}

async function pick(page: Page, name: string, rgb: [number, number, number]): Promise<void> {
    await page.locator('input[type="file"]').setInputFiles({
        name,
        mimeType: "image/png",
        buffer: pngImage(300, rgb),
    })
}

test("three photos, the third made the main one; a fourth has no place", async ({ page }) => {
    await openOsh(page)
    await pick(page, "1.png", [220, 38, 38])
    await expect(page.getByRole("button", { name: "Rasm 1: Asosiy" })).toBeVisible()
    await pick(page, "2.png", [22, 163, 74])
    await pick(page, "3.png", [37, 99, 235])
    await expect(page.getByRole("button", { name: "Rasm 3" })).toBeVisible()
    // Three is all: «Rasm qo'shish» is gone.
    await expect(page.getByRole("button", { name: "Rasm qo'shish" })).toHaveCount(0)
    await page.getByRole("button", { name: "Rasm 3" }).click()
    await page.getByRole("button", { name: "Asosiy qilish" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    expect(await photos()).toHaveLength(3)
})

test("an older photo made main, then the main one taken away: the next is main", async ({
    page,
}) => {
    const [first, second, third] = await photos()
    await openOsh(page)
    await page.getByRole("button", { name: "Rasm 3" }).click()
    await page.getByRole("button", { name: "Asosiy qilish" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    expect(await photos()).toEqual([third, first, second])

    await openOsh(page)
    await page.getByRole("button", { name: "Rasm 1: Asosiy" }).click()
    await page.getByRole("button", { name: "Rasmni o'chirish" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    expect(await photos()).toEqual([first, second])
})

test("the customer swipes through them in the sheet; the menu shows the main one", async ({
    page,
}) => {
    const [main = ""] = await photos()
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    const row = page.locator("li").filter({ hasText: "To'y oshi" }).first()
    await expect(row.locator("img")).toHaveAttribute(
        "src",
        new RegExp(main.split("/").at(-1) ?? ""),
    )
    await row.getByRole("button", { name: /^To'y oshi/ }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByRole("button", { name: "1-rasm" })).toHaveAttribute(
        "aria-current",
        "true",
    )
    await sheet.getByRole("button", { name: "2-rasm" }).click()
    await expect(sheet.getByRole("button", { name: "2-rasm" })).toHaveAttribute(
        "aria-current",
        "true",
    )
    await expect(sheet.getByRole("img")).toHaveCount(2)
})
