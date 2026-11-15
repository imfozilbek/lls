/**
 * The shop's stock (owner's decisions, November 2026): the owner counts what is left of a product
 * when they want; an order takes from it and a cancel gives it back; at zero the customer still
 * sees the product as it is and cannot add it.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { shopChat } from "../support/telegram.js"
import { bottomButton, fillAddress, openApp, toCart } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const OSH = "dev-food-p1"

async function stockOf(): Promise<number | undefined> {
    const page = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/products", { shop: FOOD })
    ).json()) as { data: { id: string; stock?: number }[] }
    return page.data.find((p) => p.id === OSH)?.stock
}

async function setStock(stock: number | null): Promise<void> {
    const response = await apiAs(PEOPLE.foodOwner, `/owner/products/${OSH}`, {
        shop: FOOD,
        method: "PATCH",
        json: { stock },
    })
    expect(response.status).toBe(200)
}

async function storefront(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
}

test("the owner counts it: «Qoldiqni hisoblash», how many, and the catalog says it", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await page.getByRole("button", { name: /^To'y oshi/ }).click()
    await page.getByRole("switch", { name: "Qoldiqni hisoblash" }).click()
    const count = page.getByLabel(/Omborda qancha bor/)
    // Counted with no number yet: the save says what is missing.
    await bottomButton(page).click()
    await expect(page.getByText("Omborda qancha borligini yozing").first()).toBeVisible()
    await count.fill("2")
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    expect(await stockOf()).toBe(2)
    await page.getByRole("tab", { name: "Menyu" }).click()
    await expect(page.getByText("2 ta qoldi")).toBeVisible()
})

test("the last two ordered: the storefront shows «Tugagan» and no «+»", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: OSH, quantity: 2 }])
    expect(await stockOf()).toBe(0)
    // The customer never learns the number, only that it is gone.
    const shelf = (await (
        await apiAs(PEOPLE.customer, "/shop/products", { shop: FOOD })
    ).json()) as {
        data: { id: string; stock?: number; soldOut?: boolean }[]
    }
    const osh = shelf.data.find((p) => p.id === OSH)
    expect(osh).toMatchObject({ soldOut: true })
    expect(osh).not.toHaveProperty("stock")

    await storefront(page)
    await expect(page.getByText("Tugagan").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Qo'shish: To'y oshi" })).toHaveCount(0)
    // Its sheet shows it as it is, and «Tugagan» cannot be pressed.
    await page
        .getByRole("button", { name: /^To'y oshi/ })
        .first()
        .click()
    await expect(page.getByRole("dialog").getByRole("button", { name: "Tugagan" })).toBeDisabled()

    // The owner cancels: the two come back, and so does «+».
    const cancelled = await apiAs(PEOPLE.foodOwner, `/owner/orders/${order.id}`, {
        shop: FOOD,
        method: "PATCH",
        json: { status: "cancelled", reason: "Mijoz so'radi" },
    })
    expect(cancelled.status).toBe(200)
    expect(await stockOf()).toBe(2)
    await storefront(page)
    await expect(page.getByRole("button", { name: "Qo'shish: To'y oshi" })).toBeVisible()
})

test("less left than the cart holds: the cart comes down to it and says so", async ({ page }) => {
    await shopChat(FOOD).shareContact(PEOPLE.customer, "+998901234567")
    await storefront(page)
    await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
    await page.getByRole("button", { name: "Ko'paytirish" }).first().click()
    await toCart(page)
    await fillAddress(page, "Mustaqillik 5")
    // Meanwhile one more was sold at the counter: the owner wrote 1.
    await setStock(1)
    await bottomButton(page).click()
    await expect(
        page.getByText("To'y oshi: faqat 1 ta qoldi. Savatdagi sonini kamaytirdik."),
    ).toBeVisible()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toBeVisible()
    expect(await stockOf()).toBe(0)

    // Back to selling it as before: not counted.
    await setStock(null)
    expect(await stockOf()).toBeUndefined()
})
