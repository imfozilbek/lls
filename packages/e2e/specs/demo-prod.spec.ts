/**
 * Demo shops in production («Namuna»): the admin makes a live shop a demo in «Platforma». It
 * leaves the showcase, says on its storefront and in every message that its orders are not
 * real, shows a test card, and «Namunani tozalash» starts it again.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

async function shopCard(page: Page): Promise<ReturnType<Page["getByRole"]>> {
    await openApp(page, { user: PEOPLE.admin, businessBot: true })
    await page.getByRole("button", { name: /Platforma/ }).click()
    await page.getByRole("tab", { name: "Bizneslar" }).click()
    return page.getByRole("listitem").filter({ hasText: "Osh Markaz" })
}

async function showcaseNames(): Promise<string[]> {
    const shops = (await (await apiAs(PEOPLE.customer, "/showcase/shops")).json()) as {
        data: { name: string }[]
    }
    return shops.data.map((shop) => shop.name)
}

test("«Namuna qilish»: the shop leaves the showcase and says it is a demo", async ({ page }) => {
    expect(await showcaseNames()).toContain("Osh Markaz")
    const card = await shopCard(page)
    await card.getByRole("button", { name: "Namuna qilish" }).click()
    await expect(page.getByText("Osh Markaz endi namuna do'kon")).toBeVisible()
    await expect(card.getByRole("button", { name: "Namunani tozalash" })).toBeVisible()
    await expect(card.getByRole("switch", { name: "Zumda vitrinasida" })).toHaveCount(0)
    expect(await showcaseNames()).not.toContain("Osh Markaz")

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("note")).toHaveText(
        "Bu namuna do'kon: buyurtma haqiqiy emas, pul o'tkazmang.",
    )

    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await expect(page.getByRole("banner").getByText("Namuna")).toBeVisible()
})

test("a demo order: «Namuna» in every message, a test card to look at", async ({ page }) => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await waitForMessage(PEOPLE.foodOwner.id, "Namuna buyurtma", since)
    await waitForMessage(PEOPLE.customer.id, "Namuna buyurtma", since)

    await openApp(page, {
        user: PEOPLE.customer,
        shop: FOOD,
        query: `?shop=${FOOD}&order=${order.id}`,
    })
    await expect(page.getByText("0000 0000 0000 0000")).toBeVisible()
    await expect(page.getByText(/Namuna karta: bu do'kon namuna/)).toBeVisible()
    await expect(page.getByText(/do'koniga tegishli/)).toHaveCount(0)
})

test("«Namunani tozalash»: the demo's orders are gone", async ({ page }) => {
    const before = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/orders?limit=10", { shop: FOOD })
    ).json()) as { data: unknown[] }
    expect(before.data.length).toBeGreaterThan(0)

    const card = await shopCard(page)
    await card.getByRole("button", { name: "Namunani tozalash" }).click()
    await expect(page.getByText("Namuna tozalandi")).toBeVisible()

    const after = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/orders?limit=10", { shop: FOOD })
    ).json()) as { data: unknown[] }
    expect(after.data).toEqual([])
})
