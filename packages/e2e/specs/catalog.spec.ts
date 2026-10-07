/**
 * Goal 17: the Zumda catalog in the product form. The owner types a few letters, picks a ready
 * product, writes only the prices; «Saqlash va yana qo'shish» goes on to the next one; a draft is
 * never lost by «back»; «Nusxa olish» starts a product from another.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, SERVICE, apiAs, resetStand } from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

interface Product {
    id: string
    name: string
    unit: string
    category: string
    price: number
    options?: {
        group?: string
        variants: { name: string; price: number }[]
        addons: { name: string }[]
    }
}

async function products(owner = PEOPLE.foodOwner, shop = FOOD): Promise<Product[]> {
    const response = await apiAs(owner, "/owner/products", { shop })
    return ((await response.json()) as { data: Product[] }).data
}

async function newProduct(page: Page, tab: string): Promise<void> {
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: tab }).click()
    await bottomButton(page).click() // «Mahsulot qo'shish»
    await expect(page.getByLabel("Katalogdan qidirish")).toBeVisible()
}

test("«To'y oshi» from the catalog: only the prices are left; then the next one", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await newProduct(page, "Menyu")
    await page.getByLabel("Katalogdan qidirish").fill("toy oshi")
    await page.getByRole("button", { name: /^To'y oshi/ }).click()
    await expect(page.getByLabel("Nomi", { exact: true })).toHaveValue("To'y oshi")
    await expect(page.getByText("Katalogdan", { exact: true })).toBeVisible()
    // Its portions are there; the owner writes their prices.
    await expect(page.getByLabel("Nima tanlanadi?")).toHaveValue("Porsiya")
    await page.getByLabel("Narxi: 0,5 porsiya").fill("30000")
    await page.getByLabel("Narxi: 0,7 porsiya").fill("38000")
    await page.getByLabel("Narxi: 1 porsiya").fill("45000")
    // The usual add-ons are offered, never added by themselves.
    await page.getByRole("button", { name: "qazi" }).click()
    await page.getByLabel("Narxi: qazi").fill("12000")
    await page.getByRole("button", { name: "Saqlash va yana qo'shish" }).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    // The next product starts at the search again.
    await expect(page.getByLabel("Katalogdan qidirish")).toHaveValue("")

    const saved = (await products()).find((p) => p.name === "To'y oshi" && p.options)
    expect(saved).toMatchObject({
        category: "osh",
        unit: "portion",
        price: 30_000,
        options: {
            group: "Porsiya",
            variants: [
                { name: "0,5 porsiya", price: 30_000 },
                { name: "0,7 porsiya", price: 38_000 },
                { name: "1 porsiya", price: 45_000 },
            ],
            addons: [{ name: "qazi" }],
        },
    })
})

test("a typed draft is not lost by «back»: it asks first", async ({ page }) => {
    // The owner answers «Qolish» (stay) to the question.
    const app = await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, confirm: false })
    await newProduct(page, "Menyu")
    await page.getByLabel("Katalogdan qidirish").fill("Chuchvara")
    await page.getByRole("button", { name: "«Chuchvara» deb o'zim yozaman" }).click()
    await page.getByLabel("Narxi").fill("25000")
    await app.back()
    await expect
        .poll(async () => {
            const asked = (await app.calls()).filter((c) => c.method === "showPopup")
            return (asked.at(-1)?.args[0] as { message?: string } | undefined)?.message ?? ""
        })
        .toContain("saqlanmaydi")
    await expect(page.getByLabel("Nomi", { exact: true })).toHaveValue("Chuchvara")
})

test("«Nusxa olish» starts a new product from an old one", async ({ page }) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await page
        .getByRole("button", { name: /^Lag'mon/ })
        .first()
        .click()
    await page.getByRole("button", { name: "Nusxa olish" }).click()
    await expect(page.getByRole("heading", { name: "Yangi mahsulot" })).toBeVisible()
    await expect(page.getByLabel("Nomi", { exact: true })).toHaveValue("Lag'mon")
    await page.getByLabel("Nomi", { exact: true }).fill("Qovurma lag'mon")
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    const names = (await products()).map((p) => p.name)
    expect(names).toContain("Lag'mon")
    expect(names).toContain("Qovurma lag'mon")
})

test("a service from the catalog: carpet washing per m², by the kind of carpet", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.serviceOwner, shop: SERVICE })
    await newProduct(page, "Xizmatlar")
    await page.getByLabel("Katalogdan qidirish").fill("gilam")
    await page
        .getByRole("button", { name: /^Gilam yuvish/ })
        .first()
        .click()
    await expect(page.getByRole("button", { name: "m²", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(page.getByLabel("Nima tanlanadi?")).toHaveValue("Gilam turi")
    const names = page.getByLabel("Variant nomi")
    const count = await names.count()
    for (let i = 0; i < count; i++) {
        await page
            .getByLabel(`Narxi: ${await names.nth(i).inputValue()}`)
            .fill(String(12_000 + i * 2_000))
    }
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    const carpet = (await products(PEOPLE.serviceOwner, SERVICE)).find(
        (p) => p.name === "Gilam yuvish",
    )
    expect(carpet).toMatchObject({ unit: "m2", category: "carpet", price: 12_000 })
})
