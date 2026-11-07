/**
 * A toy shop sorts its toys the way parents look for them (owner's decision, November 2026): a
 * product stands in up to three categories («Mantiqiy o'yinlar» and «Kitoblar» at once) and says
 * the age it is for; the storefront has a tab for each age and each category.
 */
import { expect, test } from "@playwright/test"

import { PEOPLE, STORE, resetStand } from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

async function newProduct(page: Page, name: string, price: string): Promise<void> {
    await bottomButton(page).click() // «Mahsulot qo'shish»
    await expect(page.getByRole("heading", { name: "Yangi mahsulot" })).toBeVisible()
    await page.getByLabel("Katalogdan qidirish").fill(name)
    await expect(bottomButton(page)).toHaveText(`«${name}» deb o'zim yozaman`)
    await bottomButton(page).click()
    await page.getByLabel("Narxi").fill(price)
}

async function save(page: Page): Promise<void> {
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
}

test("the owner puts a toy in two categories with its age, a rattle in another", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.storeOwner, shop: STORE })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Katalog" }).click()

    await newProduct(page, "Mantiqiy kubik", "90000")
    // The name already chose «Mantiqiy o'yinlar»: a tap keeps it, the next ones add.
    const chip = (name: string): ReturnType<Page["getByRole"]> =>
        page.getByRole("button", { name, exact: true })
    await expect(chip("Mantiqiy o'yinlar")).toHaveAttribute("aria-pressed", "true")
    await chip("Mantiqiy o'yinlar").click()
    await page.getByRole("button", { name: "Boshqa bo'limlar" }).click()
    await chip("Kitoblar").click()
    await chip("Rivojlantiruvchi o'yinchoqlar").click()
    // A fourth has no room; the third goes again with a tap.
    await chip("Bolalar tovarlari").click()
    await expect(page.getByText("Bitta mahsulot 3 tagacha bo'limda turadi")).toBeVisible()
    await expect(chip("Bolalar tovarlari")).toHaveAttribute("aria-pressed", "false")
    await chip("Rivojlantiruvchi o'yinchoqlar").click()
    await expect(chip("Rivojlantiruvchi o'yinchoqlar")).toHaveAttribute("aria-pressed", "false")
    await expect(chip("Kitoblar")).toHaveAttribute("aria-pressed", "true")
    // Children's goods ask for the age.
    await expect(page.getByRole("heading", { name: "Yoshi" })).toBeVisible()
    await chip("3+").click()
    await save(page)

    await newProduct(page, "Shaqildoq", "25000")
    // No word of the name is known: the shop's usual category is only a guess, a tap replaces it.
    await page.getByRole("button", { name: "Boshqa bo'limlar" }).click()
    await chip("Rivojlantiruvchi o'yinchoqlar").click()
    await expect(chip("Rivojlantiruvchi o'yinchoqlar")).toHaveAttribute("aria-pressed", "true")
    await expect(chip("Xo'jalik mollari")).toHaveAttribute("aria-pressed", "false")
    await chip("0+").click()
    await save(page)
})

test("the customer finds them by age and by category, each toy under each of its tabs", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: STORE })
    const tabs = page.getByRole("navigation").first()
    const tab = (name: string): ReturnType<Page["getByRole"]> =>
        tabs.getByRole("button", { name, exact: true })
    const kubik = page.getByRole("heading", { name: "Mantiqiy kubik" })
    const rattle = page.getByRole("heading", { name: "Shaqildoq" })

    // The ages come first, then the categories.
    await expect(tab("0+")).toBeVisible()
    const names = await tabs.getByRole("button").allTextContents()
    expect(names.slice(0, 3)).toEqual(["Hammasi", "0+", "3+"])
    for (const name of ["Mantiqiy o'yinlar", "Kitoblar", "Rivojlantiruvchi o'yinchoqlar"]) {
        expect(names).toContain(name)
    }

    await tab("3+").click()
    await expect(tab("3+")).toHaveAttribute("aria-pressed", "true")
    await expect(tab("Hammasi")).toHaveAttribute("aria-pressed", "false")
    await expect(kubik).toBeVisible()
    await expect(rattle).toHaveCount(0)
    // The age is on the card too.
    await expect(page.locator("li, article").filter({ has: kubik })).toContainText("3+")

    await tab("Kitoblar").click()
    await expect(kubik).toBeVisible()
    await expect(rattle).toHaveCount(0)

    await tab("0+").click()
    await expect(rattle).toBeVisible()
    await expect(kubik).toHaveCount(0)

    await tab("Hammasi").click()
    await expect(kubik).toBeVisible()
    await expect(rattle).toBeVisible()
})
