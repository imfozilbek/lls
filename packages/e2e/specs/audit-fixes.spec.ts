/**
 * The audit of 7 October 2026: what people would hit, end to end. A photo that failed never makes
 * a product twice; the order opened from a bot message shows «O'tkazdim» without a reload; the
 * receipt sheet has no dead button under it.
 */
import { expect, test } from "@playwright/test"

import { pngImage } from "../support/images.js"
import { FOOD, PEOPLE, apiAs, placeOrder, resetStand, sendReceipt } from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { appQueryOf, bottomButton, openApp } from "../support/webapp.js"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("a photo that failed to upload: «Saqlash» again saves it, never a second product", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Menyu" }).click()
    await bottomButton(page).click() // «Mahsulot qo'shish»
    await page.getByLabel("Katalogdan qidirish").fill("Chuchvara")
    await page.getByRole("button", { name: "«Chuchvara» deb o'zim yozaman" }).click()
    await page.locator('input[type="file"]').setInputFiles({
        name: "chuchvara.png",
        mimeType: "image/png",
        buffer: pngImage(300),
    })
    await page.getByLabel("Narxi").fill("25000")
    // The weak network drops the photo once.
    let failed = false
    await page.route("**/image", async (route) => {
        if (!failed && route.request().method() === "PUT") {
            failed = true
            await route.fulfill({ status: 503, body: "" })
            return
        }
        await route.continue()
    })
    await bottomButton(page).click()
    await expect.poll(() => failed).toBe(true)
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()

    const products = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/products?limit=100", { shop: FOOD })
    ).json()) as { data: { name: string; imageKey?: string }[] }
    const made = products.data.filter((p) => p.name === "Chuchvara")
    expect(made).toHaveLength(1)
    expect(made[0]?.imageKey).toBeTruthy()
})

test("the order opened from a message shows «O'tkazdim» when the customer sends it", async ({
    page,
}) => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    const card = await waitForMessage(PEOPLE.foodOwner.id, `#${order.number}`, since)
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, query: appQueryOf(card.buttons) })
    const focused = page.getByRole("region", { name: "Xabardagi buyurtma" })
    await expect(focused).toContainText(`Buyurtma #${order.number}`)

    expect((await sendReceipt(PEOPLE.customer, FOOD, order.id)).status).toBe(200)
    // The list's own check (every 20 s) brings it into the opened card too: marked to check.
    await expect(focused.locator("[data-needs-check]")).toBeVisible({ timeout: 35_000 })
})

test("the receipt sheet: the big button waits under it, the sheet's own button sends", async ({
    page,
}) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await openApp(page, {
        user: PEOPLE.customer,
        shop: FOOD,
        query: `?shop=${FOOD}&order=${order.id}`,
    })
    await expect(page.getByText(`Buyurtma #${order.number}`)).toBeVisible()
    await bottomButton(page).click() // «O'tkazdim»
    const sheet = page.getByRole("dialog").filter({ hasText: "O'tkazma cheki" })
    await expect(sheet).toBeVisible()
    // Nothing to tap behind the sheet: its own «Chekni yuborish» is the only way on.
    await expect(bottomButton(page)).toBeHidden()
    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
    await expect(bottomButton(page)).toBeVisible()
})
