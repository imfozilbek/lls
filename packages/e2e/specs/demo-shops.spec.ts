/**
 * The stand's demo shops: one of every kind of business (and water), each ready to work. The
 * customer sees the shop's logo and that it is open; the owner has nothing left in «Ishga tayyor»;
 * an order goes through in every one of them.
 */
import { expect, test } from "@playwright/test"

import {
    FOOD,
    GROCERY,
    PEOPLE,
    SERVICE,
    STORE,
    WATER,
    apiAs,
    placeOrder,
    resetStand,
} from "../support/stand.js"
import { openApp } from "../support/webapp.js"

import type { TgUser } from "../support/telegram.js"

interface Demo {
    slug: string
    name: string
    owner: TgUser
    /** An order the shop takes: its first product, above the shop's minimal order. */
    line: { productId: string; quantity: number }
    extra?: Record<string, unknown>
}

const DEMOS: Demo[] = [
    {
        slug: FOOD,
        name: "Osh Markaz",
        owner: PEOPLE.foodOwner,
        line: { productId: "dev-food-p1", quantity: 1 },
    },
    {
        slug: WATER,
        name: "Toza Suv",
        owner: PEOPLE.waterOwner,
        line: { productId: "dev-water-p1", quantity: 2 },
    },
    {
        slug: GROCERY,
        name: "Baraka Market",
        owner: PEOPLE.groceryOwner,
        line: { productId: "dev-grocery-p1", quantity: 2000 },
    },
    {
        slug: SERVICE,
        name: "Toza Gilam",
        owner: PEOPLE.serviceOwner,
        line: { productId: "dev-service-p1", quantity: 10 },
    },
    {
        slug: STORE,
        name: "Uy Bozori",
        owner: PEOPLE.storeOwner,
        line: { productId: "dev-store-p1", quantity: 1 },
        // The store takes both: this customer pays the courier in cash.
        extra: { paymentMethod: "cash" },
    },
]

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

for (const demo of DEMOS) {
    test(`${demo.name}: open, with its logo, nothing left to set up, takes an order`, async ({
        page,
    }) => {
        await openApp(page, { user: PEOPLE.customer, shop: demo.slug })
        await expect(page.getByRole("heading", { name: demo.name, exact: true })).toBeVisible()
        await expect(page.getByText("Bugun kecha-kunduz ochiq")).toBeVisible()
        // The logo is a picture the browser could draw, not the shop's letter.
        const logo = page.locator('img[src*="/logo/"]').first()
        await expect(logo).toBeVisible()
        await expect
            .poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
            .toBeGreaterThan(0)

        await openApp(page, { user: demo.owner, shop: demo.slug })
        await page.getByRole("button", { name: "Mening do'konim" }).click()
        await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
        await expect(page.getByText("Faol buyurtma yo'q")).toBeVisible()
        await expect(page.getByText("Ishga tayyor")).toHaveCount(0)

        const order = await placeOrder(PEOPLE.customer, demo.slug, [demo.line], demo.extra)
        expect(order.number).toBe(1)
    })
}

test("the showcase lists the demo shops with a showcase deal", async () => {
    const shops = (await (await apiAs(PEOPLE.customer, "/showcase/shops")).json()) as {
        data: { name: string }[]
    }
    expect(shops.data.map((shop) => shop.name).sort()).toEqual([
        "Baraka Market",
        "Osh Markaz",
        "Uy Bozori",
    ])
})
