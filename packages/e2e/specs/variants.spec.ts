/**
 * Goal 17: variants and add-ons. The owner gives a latte three sizes and a syrup; the customer
 * picks «0,4 l» with the syrup; the server prices it; the owner's message names the pick.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, messagesTo } from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

interface Product {
    id: string
    name: string
    price: number
    options?: {
        group?: string
        variants: { id: string; name: string; price: number }[]
        addons: { id: string; name: string; price: number }[]
    }
}

async function latte(): Promise<Product | undefined> {
    const catalog = (await (
        await apiAs(PEOPLE.customer, "/shop/products", { shop: FOOD })
    ).json()) as { data: Product[] }
    return catalog.data.find((p) => p.name === "Latte")
}

test("the owner gives a latte sizes and a syrup; the price lives in the sizes", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await bottomButton(page).click() // «Mahsulot qo'shish»
    await page.getByLabel("Nomi").fill("Latte")
    await page.getByRole("button", { name: /Variantlar/ }).click()
    await page.getByLabel("Nima tanlanadi?").fill("Hajmi")
    const names = page.getByLabel("Variant nomi")
    await names.nth(0).fill("0,3 l")
    // A named variant takes the price over: the product costs as its cheapest one.
    await expect(page.getByText("Narx variantlarda")).toBeVisible()
    await page.getByLabel("Narxi: 0,3 l").fill("15000")
    await names.nth(1).fill("0,4 l")
    await page.getByLabel("Narxi: 0,4 l").fill("18000")
    await page.getByRole("button", { name: "Yana variant" }).click()
    await names.nth(2).fill("0,5 l")
    await page.getByLabel("Narxi: 0,5 l").fill("22000")
    await page.getByRole("button", { name: /Qo'shimchalar/ }).click()
    await page.getByLabel("Qo'shimcha nomi").fill("Karamel sirop")
    await page.getByLabel("Narxi: Karamel sirop").fill("4000")
    await bottomButton(page).click() // «Saqlash»
    await expect(page.getByText("Saqlandi")).toBeVisible()

    const product = await latte()
    expect(product?.price).toBe(15_000)
    expect(product?.options).toMatchObject({
        group: "Hajmi",
        variants: [
            { name: "0,3 l", price: 15_000 },
            { name: "0,4 l", price: 18_000 },
            { name: "0,5 l", price: 22_000 },
        ],
        addons: [{ name: "Karamel sirop", price: 4_000 }],
    })
})

test("the customer picks «0,4 l» with the syrup: 22 000 a cup, priced by the server", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    const row = page.getByRole("listitem").filter({ hasText: "Latte" })
    await expect(row.getByText("dan")).toBeVisible()
    await row.getByRole("button", { name: "Qo'shish: Latte" }).click()
    const sheet = page.getByRole("dialog", { name: "Latte" })
    await expect(sheet.getByText("Hajmi")).toBeVisible()
    await sheet.getByRole("radio", { name: /0,4 l/ }).click()
    await sheet.getByRole("checkbox", { name: /Karamel sirop/ }).click()
    await sheet.getByRole("button", { name: /Savatga · 22/ }).click()
    await expect(row.getByRole("button", { name: "Qo'shish: Latte" })).toHaveText("1")

    const product = await latte()
    const medium = product?.options?.variants.find((v) => v.name === "0,4 l")
    const syrup = product?.options?.addons[0]
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        {
            productId: product?.id ?? "",
            // Two: the shop's minimal order is 40 000.
            quantity: 2,
            variantId: medium?.id,
            addonIds: [syrup?.id ?? ""],
        },
    ])
    const placed = (await (
        await apiAs(PEOPLE.customer, `/orders/${order.id}`, { shop: FOOD })
    ).json()) as { items: { total: number; options?: { label: string } }[] }
    expect(placed.items[0]).toMatchObject({
        total: 44_000,
        options: { label: "0,4 l · Karamel sirop" },
    })
    await expect
        .poll(async () =>
            (await messagesTo(PEOPLE.foodOwner.id, since)).some((m) =>
                m.text.includes("Latte (0,4 l · Karamel sirop) × 2"),
            ),
        )
        .toBe(true)
})
