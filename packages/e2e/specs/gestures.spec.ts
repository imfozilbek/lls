/**
 * The app feels native inside Telegram: a pull down refreshes instead of collapsing the app,
 * a swipe right goes back and left forward, fields never zoom and show a dark caret, closing
 * asks while there is something to lose, popups speak Uzbek, and coming back refreshes at once.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, payAndAccept, placeOrder, resetStand } from "../support/stand.js"
import { drag, pullDown, swipeLeft, swipeRight } from "../support/touch.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const P1 = "dev-food-p1"
const DISH = "To'y oshi"

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const owner = (path: string, json: object, method = "PATCH"): Promise<Response> =>
    apiAs(PEOPLE.foodOwner, path, { shop: FOOD, method, json })

async function openOrder(page: Page, number: number): ReturnType<typeof openApp> {
    const app = await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Buyurtmalarim" }).click()
    await page.getByRole("button", { name: new RegExp(`Buyurtma #${number}`) }).click()
    await expect(page.getByRole("heading", { name: `Buyurtma #${number}` })).toBeVisible()
    return app
}

test("start: no collapse on a downward swipe, upright only", async ({ page }) => {
    const app = await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    const methods = (await app.calls()).map((c) => c.method)
    expect(methods).toContain("disableVerticalSwipes")
    expect(methods).toContain("lockOrientation")
})

test("pull down on the order screen refreshes it in place, without a skeleton", async ({
    page,
}) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    const app = await openOrder(page, order.number)
    await expect(page.getByText("O'tkazma kutilmoqda").first()).toBeVisible()
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    await pullDown(page)
    await expect(page.getByText("Do'kon buyurtmani qabul qildi")).toBeVisible()
    await expect(page.locator(".skeleton")).toHaveCount(0)
    await expect(page.getByTestId("pull-indicator")).toBeHidden()
    const haptics = (await app.calls()).filter((c) => c.method === "haptic.impact")
    expect(haptics.map((c) => c.args[0])).toContain("medium")
})

test("coming back to the app refreshes the order at once", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    const app = await openOrder(page, order.number)
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    await app.fire("deactivated")
    await app.fire("activated")
    await expect(page.getByText("Do'kon buyurtmani qabul qildi")).toBeVisible()
})

test("swipe right goes back, swipe left forward again; a sideways list scrolls itself", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: `Qo'shish: ${DISH}` }).click()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
    await swipeRight(page)
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    // The category chips scroll sideways: a swipe on them is theirs, not "forward".
    const chips = page.getByRole("navigation").first()
    const box = await chips.boundingBox()
    if (box && (await chips.evaluate((el) => el.scrollWidth > el.clientWidth))) {
        const y = box.y + box.height / 2
        await drag(page, { x: 330, y }, { x: 80, y: y + 4 })
        await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    }
    await swipeLeft(page)
    await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
})

test("checkout: fields are 16px with a dark caret; closing asks while the cart waits", async ({
    page,
}) => {
    const app = await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: `Qo'shish: ${DISH}` }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()
    const fields = await page.locator("input, textarea").evaluateAll((elements) =>
        elements
            .filter((el) => (el as HTMLElement).offsetParent !== null)
            .map((el) => ({
                size: getComputedStyle(el).fontSize,
                caret: getComputedStyle(el).caretColor,
            })),
    )
    expect(fields.length).toBeGreaterThan(0)
    for (const field of fields) {
        expect(field.size).toBe("16px")
        expect(field.caret).toBe("rgb(17, 24, 39)")
    }
    expect((await app.calls()).map((c) => c.method)).toContain("enableClosingConfirmation")
    await swipeRight(page)
    await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
    expect((await app.calls()).map((c) => c.method).at(-1)).not.toBe("enableClosingConfirmation")
    expect((await app.calls()).map((c) => c.method)).toContain("disableClosingConfirmation")
})

test("cancelling asks in Uzbek with a red button; a swipe right closes a sheet", async ({
    page,
}) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    const app = await openOrder(page, order.number)
    await page.getByRole("button", { name: "Buyurtmani bekor qilish" }).click()
    const popup = (await app.calls()).filter((c) => c.method === "showPopup").at(-1)
    expect(popup?.args[0]).toMatchObject({
        buttons: [
            { id: "no", type: "default", text: "Yo'q" },
            { id: "yes", type: "destructive", text: "Buyurtmani bekor qilish" },
        ],
    })
    await expect(page.getByText("Bekor qilindi").first()).toBeVisible()

    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    const card = page.getByRole("listitem").filter({ hasText: "Buyurtma #" }).first()
    await card.getByRole("button", { name: "Bekor qilish" }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await swipeRight(page)
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.getByRole("tab", { name: "Buyurtmalar" })).toBeVisible()
})

test("after a delivered order, the shop's icon may go to the home screen", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    for (const status of ["preparing", "ready", "picked_up", "delivered"]) {
        expect((await owner(`/owner/orders/${order.id}`, { status })).status).toBe(200)
    }
    const app = await openOrder(page, order.number)
    await page.getByRole("button", { name: /Do'konni bosh ekranga qo'shish/ }).click()
    expect((await app.calls()).map((c) => c.method)).toContain("addToHomeScreen")
    await expect(page.getByRole("button", { name: /Do'konni bosh ekranga qo'shish/ })).toBeHidden()
})
