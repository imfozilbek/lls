/**
 * The delivery price is the owner's choice (owner's decision, November 2026): a shop that never
 * chose says nothing about delivery, never «bepul»; «Ishga tayyor» asks for it; «Bepul» is then
 * said on every screen and in the bot; «Narxi bor» needs a price; a service says nothing about
 * delivery at all.
 */
import { expect, test } from "@playwright/test"

import { runSql } from "../stand/seed.js"
import { GROCERY, PEOPLE, SERVICE, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp, openGroup, settingsBack, toCart } from "../support/webapp.js"

import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(async () => {
    await resetStand()
    // As an application leaves a shop: no fee, nothing chosen (four live shops were like this).
    runSql(
        `UPDATE businesses SET delivery_fee = 0, free_delivery_from = NULL,
            delivery_price_set = 0 WHERE slug = '${GROCERY}'`,
    )
})

/** Two litres of milk: above the shop's minimum. */
const MILK = [{ productId: "dev-grocery-p4", quantity: 2 }]

async function cartWithMilk(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    await page.getByRole("button", { name: "Qo'shish: Sut 1 l" }).click()
    await toCart(page)
}

test("a price never chosen: no «bepul» on the storefront, in the cart, the order or the bot", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    await expect(page.getByRole("heading", { name: "Baraka Market" })).toBeVisible()
    await expect(page.getByText("Bepul yetkazish")).toHaveCount(0)
    await expect(page.getByText(/Yetkazish \d/)).toHaveCount(0)

    await cartWithMilk(page)
    await expect(page.getByText("Mahsulotlar", { exact: true })).toBeVisible()
    await expect(page.getByText("Yetkazib berish", { exact: true })).toHaveCount(0)

    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, GROCERY, MILK)
    expect(order).toMatchObject({ deliveryFee: 0, deliveryFree: false })
    const toOwner = await waitForMessage(PEOPLE.groceryOwner.id, `#${order.number}`, since)
    expect(toOwner.text).not.toContain("Yetkazib berish")
    await openApp(page, {
        user: PEOPLE.customer,
        shop: GROCERY,
        query: `?shop=${GROCERY}&order=${order.id}`,
    })
    await expect(page.getByText("Jami", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Yetkazib berish", { exact: true })).toHaveCount(0)
})

test("«Ishga tayyor» asks for the price; «Bepul» is then said everywhere", async ({ page }) => {
    await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    // An order is waiting, so the card is folded on its next step: open it, then the step.
    await expect(page.getByText("Buyurtma #1", { exact: true })).toBeVisible()
    const folded = page.getByRole("button", { expanded: false }).filter({ hasText: "Ishga tayyor" })
    await expect(folded).toContainText("Yetkazib berish narxi")
    await folded.click()
    await page
        .getByRole("region", { name: "Ishga tayyor" })
        .getByRole("button", { name: /Yetkazib berish narxi/ })
        .click()
    await expect(page.getByRole("heading", { name: "Yetkazib berish", level: 1 })).toBeVisible()
    const choices = page.getByRole("radiogroup", { name: "Yetkazib berish narxi" })
    await expect(page.getByText("Hali tanlanmagan, mijozlar buni ko'rmaydi")).toBeVisible()
    await expect(choices.getByRole("radio", { checked: true })).toHaveCount(0)
    // No dispatcher here: «Bepul» comes first.
    await expect(choices.getByRole("radio").first()).toContainText("Bepul")

    await choices.getByRole("radio", { name: /Bepul/ }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi").first()).toBeVisible()
    await settingsBack(page)
    await expect(
        page.getByRole("button", { name: /Yetkazib berish\s*Bepul yetkazish/ }),
    ).toBeVisible()

    await cartWithMilk(page)
    await expect(page.getByText("bepul", { exact: true })).toBeVisible()
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, GROCERY, MILK)
    expect(order).toMatchObject({ deliveryFee: 0, deliveryFree: true })
    const toOwner = await waitForMessage(PEOPLE.groceryOwner.id, `#${order.number}`, since)
    expect(toOwner.text).toContain("Yetkazib berish: bepul")
    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    await expect(page.getByText("Bepul yetkazish")).toBeVisible()
})

test("«Narxi bor» needs a price above zero, then the storefront shows it", async ({ page }) => {
    await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    await openGroup(page, "Yetkazib berish")
    await page
        .getByRole("radiogroup", { name: "Yetkazib berish narxi" })
        .getByRole("radio", { name: /Narxi bor/ })
        .click()
    // Never a dead button: a tap says what is missing.
    await bottomButton(page).click()
    await expect(page.getByText("Narxini kiriting").first()).toBeVisible()
    await page.getByLabel("Yetkazish narxi").fill("8000")
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi").first()).toBeVisible()

    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    await expect(page.getByText(/Yetkazish 8\s000/)).toBeVisible()
})

test("a service says nothing about delivery: storefront, cart, settings, «Ishga tayyor»", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: SERVICE })
    await expect(page.getByRole("heading", { name: "Toza Gilam" })).toBeVisible()
    await expect(page.getByText(/yetkaz/i)).toHaveCount(0)
    await page.getByRole("button", { name: "Qo'shish: Avtomobil yuvish" }).click()
    await toCart(page)
    await expect(page.getByText("Yetkazib berish", { exact: true })).toHaveCount(0)
    // The stand's service has a fee stored from before: a service never charges it.
    const order = await placeOrder(PEOPLE.customer, SERVICE, [
        { productId: "dev-service-p2", quantity: 1 },
    ])
    expect(order).toMatchObject({ deliveryFee: 0, deliveryFree: false, total: 60_000 })

    await openApp(page, { user: PEOPLE.serviceOwner, shop: SERVICE })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await expect(page.getByRole("button", { name: /Yetkazib berish narxi/ })).toHaveCount(0)
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    await openGroup(page, "Xizmat hududi")
    await expect(page.getByRole("radiogroup", { name: "Yetkazib berish narxi" })).toHaveCount(0)
    await expect(page.getByLabel("Yetkazish narxi")).toHaveCount(0)
})

test("«O'zbekiston bo'ylab yetkazamiz»: the storefront says where to, the cart when the price comes", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    await openGroup(page, "Yetkazib berish")
    const nationwide = page.getByRole("switch", { name: "O'zbekiston bo'ylab yetkazamiz" })
    // Only with «Narxi keyin aytiladi»: a shop with its own price has its own couriers.
    await expect(nationwide).toHaveCount(0)
    await page
        .getByRole("radiogroup", { name: "Yetkazib berish narxi" })
        .getByRole("radio", { name: /Narxi keyin aytiladi/ })
        .click()
    await nationwide.click()
    // Across the country: no radius to set.
    await expect(page.getByLabel("Yetkazish radiusi, km")).toHaveCount(0)
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi").first()).toBeVisible()

    await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
    await expect(
        page.getByText("O'zbekiston bo'ylab yetkazib beramiz (pochta, taksi)"),
    ).toBeVisible()
    await expect(page.getByText("Yetkazib berish narxi keyin aytiladi")).toHaveCount(0)
    await page
        .getByRole("button", { name: /^Qo'shish:/ })
        .first()
        .click()
    await toCart(page)
    await expect(page.getByText("jo'natilganda ma'lum qilinadi", { exact: true })).toBeVisible()
})
