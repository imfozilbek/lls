/**
 * Zumda's own map (served by the Worker from R2; the stand has a piece around Yakkabog').
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, payAndAccept, placeOrder, resetStand } from "../support/stand.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Locator, Page } from "@playwright/test"

const CUSTOMER_PLACE = { latitude: 38.976, longitude: 66.686 }

/** A small map drawn with these pins (the shop, the customer). */
async function expectMap(scope: Locator, pins: string[]): Promise<void> {
    const map = scope.locator(".zumda-map").first()
    await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 })
    for (const pin of pins) {
        await expect(map.locator(`[data-marker="${pin}"]`)).toBeVisible()
    }
}

/** A paid, accepted food order with the customer's pin, handed to the shop's courier Jasur. */
async function assignedOrder(): Promise<string> {
    const order = await placeOrder(
        PEOPLE.customer,
        FOOD,
        [{ productId: "dev-food-p1", quantity: 2 }],
        {
            location: CUSTOMER_PLACE,
        },
    )
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    const assigned = await apiAs(PEOPLE.foodOwner, `/owner/orders/${order.id}/courier`, {
        shop: FOOD,
        method: "PUT",
        json: { courierId: "dev-food-courier" },
    })
    expect(assigned.status).toBe(200)
    return order.id
}

async function closeViewer(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Yopish" }).click()
}

test.describe.configure({ mode: "serial" })

test.describe("the map", () => {
    test.beforeAll(resetStand)

    test("checkout: the customer moves the map under the pin and picks the place", async ({
        page,
    }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
        await bottomButton(page).click()
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()

        await page.getByRole("button", { name: "Xaritada belgilash" }).click()
        const picker = page.getByRole("dialog", { name: "Joyni belgilang" })
        await expect(picker).toBeVisible()
        const map = picker.locator(".zumda-map")
        await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 })
        await expect(picker.locator('[data-marker="shop"]')).toBeVisible()
        await page.screenshot({ path: "screenshots/light/map-picker.png" })

        const box = await map.boundingBox()
        if (!box) {
            throw new Error("no map")
        }
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 60, {
            steps: 8,
        })
        await page.mouse.up()
        await picker.getByRole("button", { name: "Shu yer" }).click()
        await expect(picker).toBeHidden()
        await expect(page.getByRole("button", { name: /Joy belgilandi/ })).toBeVisible()
    })
    test("the storefront's «Xarita» shows the shop and how far it delivers", async ({ page }) => {
        await apiAs(PEOPLE.foodOwner, "/owner/shop", {
            shop: FOOD,
            method: "PATCH",
            json: { delivery: { fee: 10_000, radiusMeters: 3_000 } },
        })
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: "Xarita" }).click()
        const viewer = page.getByRole("dialog", { name: "Xarita" })
        await expectMap(viewer, ["shop"])
        await expect(viewer.getByRole("link", { name: "Yandex xaritada ochish" })).toBeVisible()
        await page.screenshot({ path: "screenshots/light/map-storefront.png" })
        await closeViewer(page)
        await apiAs(PEOPLE.foodOwner, "/owner/shop", {
            shop: FOOD,
            method: "PATCH",
            json: { delivery: { fee: 10_000, radiusMeters: null } },
        })
    })

    test("the courier, the owner and the customer see the order on the map", async ({ page }) => {
        const orderId = await assignedOrder()

        await openApp(page, { user: PEOPLE.courier, shop: FOOD, courierBot: true })
        const card = page.getByRole("listitem").filter({ hasText: "Osh Markaz" }).first()
        await expectMap(card, ["shop", "customer"])
        await page.screenshot({ path: "screenshots/light/map-courier.png" })

        await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
        await page.getByRole("button", { name: "Mening do'konim" }).click()
        await page.getByRole("tab", { name: "Buyurtmalar" }).click()
        await page.getByRole("button", { name: "Xarita" }).first().click()
        const viewer = page.getByRole("dialog", { name: "Xarita" })
        await expectMap(viewer, ["shop", "customer"])
        await closeViewer(page)

        await page.goto("about:blank")
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: /Buyurtmalarim/ }).click()
        await page.getByRole("button").filter({ hasText: /#\d+/ }).first().click()
        await expectMap(page.locator("main"), ["shop", "customer"])
        expect(orderId).toBeTruthy()
    })
})
