/**
 * The Zumda sound («Zum-da», owner's choice): a new order rings twice for the shop and the
 * courier, the customer hears it once, softly, when the order moves. Only for real news, and
 * the shop's «Zumda ovozi» switch turns it off.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, payAndAccept, placeOrder, resetStand } from "../support/stand.js"
import { pullDown } from "../support/touch.js"
import { openApp, openSettings } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const P1 = "dev-food-p1"
const COURIER_ID = "dev-food-courier"

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

async function openOwnerOrders(page: Page): ReturnType<typeof openApp> {
    const app = await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
    return app
}

test("a new order rings the shop twice; nothing new, no sound", async ({ page }) => {
    const app = await openOwnerOrders(page)
    await page.waitForTimeout(500)
    expect(await app.zums()).toBe(0)
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    await pullDown(page)
    await expect(page.getByText(`Buyurtma #${order.number}`).first()).toBeVisible()
    await expect.poll(() => app.zums()).toBe(2)
    await pullDown(page)
    await page.waitForTimeout(900)
    expect(await app.zums()).toBe(2)
})

test("«Zumda ovozi» off: a new order comes in silence", async ({ page }) => {
    const app = await openOwnerOrders(page)
    await openSettings(page, "To'lov")
    await page.getByRole("button", { name: "Sozlamalar", exact: true }).click()
    const sound = page.getByRole("switch", { name: "Zumda ovozi" })
    await expect(sound).toBeChecked()
    await sound.click()
    await expect(sound).not.toBeChecked()
    const before = await app.zums()
    await page.getByRole("tab", { name: "Buyurtmalar" }).click()
    await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    await pullDown(page)
    await page.waitForTimeout(900)
    expect(await app.zums()).toBe(before)
    // On again: it plays once so the owner knows the sound.
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    await page.getByRole("switch", { name: "Zumda ovozi" }).click()
    await expect.poll(() => app.zums()).toBe(before + 2)
})

test("the customer hears it once, softly, when the shop accepts", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    const app = await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Buyurtmalarim" }).click()
    await page.getByRole("button", { name: new RegExp(`Buyurtma #${order.number}`) }).click()
    await expect(page.getByRole("heading", { name: `Buyurtma #${order.number}` })).toBeVisible()
    expect(await app.zums()).toBe(0)
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    await pullDown(page)
    await expect(page.getByText("Do'kon buyurtmani qabul qildi")).toBeVisible()
    await expect.poll(() => app.zums()).toBe(1)
})

test("the courier hears a new delivery", async ({ page }) => {
    const app = await openApp(page, { user: PEOPLE.courier, courierBot: true })
    await expect(page.getByRole("heading", { name: "Yetkazishlarim" })).toBeVisible()
    await page.waitForTimeout(500)
    const before = await app.zums()
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    const assigned = await apiAs(PEOPLE.foodOwner, `/owner/orders/${order.id}/courier`, {
        shop: FOOD,
        method: "PUT",
        json: { courierId: COURIER_ID },
    })
    expect(assigned.status).toBe(200)
    await pullDown(page)
    await expect(page.getByText(`#${order.number}`).first()).toBeVisible()
    await expect.poll(() => app.zums()).toBe(before + 2)
})
