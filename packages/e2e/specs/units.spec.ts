/**
 * Goal 17: any product of any kind. Spices are priced per 100 g and sold in 100 g steps, from the
 * owner's form to the storefront, the order and the owner's message; a goods store («Do'kon»)
 * is a kind of business of its own.
 */
import { expect, test } from "@playwright/test"

import { GROCERY, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, messagesTo } from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

interface Product {
    id: string
    name: string
    unit: string
    step: number
    price: number
}

test("the owner prices pepper per 100 g; the step follows the unit", async ({ page }) => {
    await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Katalog" }).click()
    await bottomButton(page).click() // «Mahsulot qo'shish»
    await expect(page.getByRole("heading", { name: "Yangi mahsulot" })).toBeVisible()
    await page.getByLabel("Nomi").fill("Qora murch")
    await page.getByRole("button", { name: "100 g", exact: true }).click()
    await expect(page.getByLabel("100 g narxi")).toBeVisible()
    await page.getByLabel("100 g narxi").fill("6000")
    // Steps of a 100 g item: 50 g, 100 g (chosen), 250 g, 500 g.
    await expect(page.getByRole("button", { name: "50 g", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "100 g", exact: true }).last()).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    // Every other unit is one tap away.
    await page.getByRole("button", { name: "Boshqa", exact: true }).click()
    await expect(page.getByRole("button", { name: "lotok", exact: true })).toBeVisible()
    await bottomButton(page).click() // «Saqlash»
    await expect(page.getByText("Saqlandi")).toBeVisible()

    const products = (await (
        await apiAs(PEOPLE.groceryOwner, "/owner/products", { shop: GROCERY })
    ).json()) as { data: Product[] }
    expect(products.data.find((p) => p.name === "Qora murch")).toMatchObject({
        unit: "g100",
        step: 100,
        price: 6000,
    })
})

test("the customer sees «/ 100 g», buys 300 g, the owner's message says «× 300 g»", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    const row = page.getByRole("listitem").filter({ hasText: "Qora murch" })
    await expect(row.getByText("/ 100 g")).toBeVisible()
    for (let tap = 0; tap < 3; tap++) {
        await row
            .getByRole("button", { name: /Qo'shish|Ko'paytirish/ })
            .first()
            .click()
    }
    await expect(row.getByText("300 g")).toBeVisible()

    const catalog = (await (
        await apiAs(PEOPLE.customer, "/shop/products", { shop: GROCERY })
    ).json()) as { data: Product[] }
    const pepper = catalog.data.find((p) => p.name === "Qora murch")
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, GROCERY, [
        { productId: pepper?.id ?? "", quantity: 300 },
        { productId: "dev-grocery-p1", quantity: 1000 },
    ])
    const items = (await (
        await apiAs(PEOPLE.customer, `/orders/${order.id}`, { shop: GROCERY })
    ).json()) as { items: { name: string; total: number }[] }
    expect(items.items.find((i) => i.name === "Qora murch")?.total).toBe(18_000)
    await expect
        .poll(async () =>
            (await messagesTo(PEOPLE.groceryOwner.id, since)).some(
                (m) => m.text.includes(`#${order.number}`) && m.text.includes("Qora murch × 300 g"),
            ),
        )
        .toBe(true)
})

test("a goods store is a kind of business in the application", async ({ page }) => {
    await openApp(page, { user: PEOPLE.newOwner, businessBot: true })
    await bottomButton(page).click() // «Boshlash»
    await expect(page.getByText("1/3-qadam")).toBeVisible()
    const store = page.getByRole("radio", { name: "Do'kon (mollar)" })
    await store.click()
    await expect(store).toBeChecked()
})
