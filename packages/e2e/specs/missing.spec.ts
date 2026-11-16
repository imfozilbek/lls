/**
 * «Yo'q» (owner's decision, November 2026): until «Tayyor» the owner takes out a line the shop did
 * not have. The sum goes down, a paid transfer owes the difference back until «Qaytardim», the
 * customer hears it and sees the line struck through; «Bugun sotuvdan olib qo'yish» stops the
 * product for today. The last line stays: the order is cancelled instead.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, payAndStart, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { openApp, openOrderCard } from "../support/webapp.js"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const OSH = "dev-food-p1"

interface Product {
    id: string
    name: string
    unit: string
    isAvailable: boolean
    unavailableUntil?: string
    options?: unknown
}

async function shelf(): Promise<Product[]> {
    const page = (await (
        await apiAs(PEOPLE.customer, "/shop/products", { shop: FOOD })
    ).json()) as { data: Product[] }
    return page.data
}

/** Another dish of the shop, sold in pieces or portions, with no variants to pick. */
async function anotherDish(): Promise<Product> {
    const found = (await shelf()).find(
        (p) => p.id !== OSH && p.isAvailable && !p.options && !p.unavailableUntil,
    )
    if (!found) {
        throw new Error("the stand's food shop has one dish only")
    }
    return found
}

test("«Yo'q» on a paid order: a lower sum, owed back, the customer told, off sale today", async ({
    page,
}) => {
    const second = await anotherDish()
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: OSH, quantity: 2 },
        { productId: second.id, quantity: 1 },
    ])
    expect((await payAndStart(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)

    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    const card = await openOrderCard(page, order.number)
    const since = await lastSeq()
    await card.getByRole("button", { name: `Yo'q: ${second.name}` }).click()
    const sheet = page.getByRole("dialog", { name: "Mahsulot qolmaganmi?" })
    await expect(sheet).toContainText(second.name)
    await expect(sheet.getByText(/o'rniga/)).toBeVisible()
    await expect(sheet.getByText(/Mijozga .+ qaytarasiz/)).toBeVisible()
    await expect(
        sheet.getByRole("switch", { name: "Bugun sotuvdan olib qo'yish" }),
    ).toHaveAttribute("aria-checked", "true")
    await sheet.getByRole("button", { name: "Buyurtmadan olib tashlash" }).click()
    await expect(sheet).toBeHidden()

    // The owner's card: the line struck through, the money owed back.
    await expect(card).toContainText("yo'q edi")
    await expect(card.getByText(/qaytarish kerak/)).toBeVisible()
    // The customer heard it from the shop's bot.
    const told = await waitForMessage(PEOPLE.customer.id, "do'konda yo'q ekan", since)
    expect(told.text).toContain(second.name)
    expect(told.text).toContain("qaytaradi")
    // Off the shelf until midnight.
    const catalog = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/products?limit=100", { shop: FOOD })
    ).json()) as { data: Product[] }
    expect(catalog.data.find((p) => p.id === second.id)?.unavailableUntil).toBeDefined()
    expect((await shelf()).some((p) => p.id === second.id && p.isAvailable)).toBe(false)

    // The last line stays: no «Yo'q» on it.
    await expect(card.getByRole("button", { name: /^Yo'q: / })).toHaveCount(0)

    // «Qaytardim», asked once more, closes it.
    await card.getByRole("button", { name: "Qaytardim" }).click()
    await expect(card.getByText(/qaytarish kerak/)).toHaveCount(0)

    // The customer sees what was missing.
    await openApp(page, {
        user: PEOPLE.customer,
        shop: FOOD,
        query: `?shop=${FOOD}&order=${order.id}`,
    })
    await expect(page.getByText("Do'konda yo'q edi")).toBeVisible()
})
