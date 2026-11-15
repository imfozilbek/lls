/**
 * A shop's courier who is a dispatcher (owner's decision, November 2026): the owner packs, the
 * dispatcher sends the parcel on by a taxi or the post and keeps the customer told with notes.
 * The order never goes on without someone on it, and the customer pays the carrier apart.
 */
import { expect, test } from "@playwright/test"

import { PEOPLE, STORE, apiAs, payAndStart, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp, openGroup, openSettings, settingsBack } from "../support/webapp.js"

import type { PlacedOrder } from "../support/stand.js"
import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

let order: PlacedOrder

/** The shop's bot message about the order opens the app on it. */
function opened(placed: PlacedOrder): string {
    return `?shop=${STORE}&order=${placed.id}`
}

function card(page: Page, number: number): ReturnType<Page["locator"]> {
    return page
        .locator("li")
        .filter({ hasText: `#${number}` })
        .first()
}

test("the owner makes the courier a dispatcher and lets the customer pay the carrier", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.storeOwner, shop: STORE })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Kuryerlar")
    const dispatcher = page.getByRole("switch", { name: "Dispetcher: Jasur" })
    await expect(dispatcher).toHaveAttribute("aria-checked", "false")
    await dispatcher.click()
    await expect(dispatcher).toHaveAttribute("aria-checked", "true")

    await settingsBack(page)
    await openGroup(page, "Yetkazib berish")
    await page.getByRole("switch", { name: "Yetkazish haqini mijoz o'zi to'laydi" }).click()
    // The fee is the carrier's now: the shop's own price steps aside.
    await expect(page.getByLabel("Yetkazish narxi")).toHaveCount(0)
    await bottomButton(page).click()
    await expect(page.getByText("Saqlandi").first()).toBeVisible()
    await settingsBack(page)
    await expect(
        page.getByRole("button", { name: /Yetkazib berish\s*Yetkazish haqini mijoz to'laydi/ }),
    ).toBeVisible()
})

test("the storefront says the delivery is paid apart; the order adds nothing for it", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: STORE })
    await expect(page.getByText("Yetkazish haqi alohida")).toBeVisible()
    await expect(page.getByText("Bepul yetkazish")).toHaveCount(0)
    order = await placeOrder(PEOPLE.customer, STORE, [{ productId: "dev-store-p1", quantity: 1 }])
    expect(order).toMatchObject({ deliveryFee: 0, customerPaysCarrier: true })
    expect((await payAndStart(PEOPLE.storeOwner, STORE, order.id)).status).toBe(200)
})

test("the shop's only courier, the dispatcher, got it by itself; the owner packs", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.storeOwner, shop: STORE, query: opened(order) })
    const mine = card(page, order.number)
    await expect(mine.getByText("Dispetcher: Jasur")).toBeVisible()
    // Someone is on it: no choice left, «Tayyor bo'ldi» is the owner's step.
    await expect(mine.getByRole("button", { name: "Kuryerga topshirish" })).toHaveCount(0)
    await mine.getByRole("button", { name: "Tayyor bo'ldi" }).click()
    await expect(mine.getByText("Dispetcher jo'natadi va mijozga yozadi")).toBeVisible()
    // The dispatcher's step is never the owner's, from the app or the API.
    await expect(mine.getByRole("button", { name: "Jo'natish" })).toHaveCount(0)
    const bare = await apiAs(PEOPLE.storeOwner, `/owner/orders/${order.id}`, {
        shop: STORE,
        method: "PATCH",
        json: { status: "picked_up" },
    })
    expect(bare.status).toBe(422)
})

test("the dispatcher sees where from and where to, sends it by post with the tracking", async ({
    page,
}) => {
    const since = await lastSeq()
    await openApp(page, { user: PEOPLE.courier, courierBot: true })
    const mine = page.locator(`li[data-order="${order.id}"]`)
    await expect(mine.getByText("Qayerdan")).toBeVisible()
    await expect(mine.getByText("Qayerga")).toBeVisible()
    await expect(mine.getByText("Navoiy 12")).toBeVisible()

    await mine.getByRole("button", { name: "Jo'natdim", exact: true }).click()
    const sheet = page.getByRole("dialog")
    const send = sheet.getByRole("button", { name: "Jo'natdim", exact: true })
    await expect(send).toBeDisabled()
    await sheet.getByRole("radio", { name: "Pochta" }).click()
    await sheet.getByRole("textbox", { name: "Mijozga izoh" }).fill("Trek: UZ123456")
    await send.click()
    await expect(page.getByText(`#${order.number} jo'natildi: mijozga xabar ketdi`)).toBeVisible()
    await expect(mine.getByText("Pochta orqali jo'natildi")).toBeVisible()
    await expect(mine.getByText("Trek: UZ123456")).toBeVisible()

    const told = await waitForMessage(PEOPLE.customer.id, "pochta orqali jo'natildi", since)
    expect(told.text).toContain("Trek: UZ123456")
    expect(told.text).toContain("Yetkazish haqini yetkazuvchiga o'zingiz to'laysiz")
    expect(told.text).toContain("Dispetcher:")

    // One more note: the customer gets it on its own.
    await mine.getByRole("button", { name: "Izoh qo'shish" }).click()
    await page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Mijozga izoh" })
        .fill("Qarshiga yetdi")
    await page.getByRole("dialog").getByRole("button", { name: "Yuborish" }).click()
    await expect(mine.getByText("Qarshiga yetdi")).toBeVisible()
    await waitForMessage(PEOPLE.customer.id, `#${order.number} buyurtma: Qarshiga yetdi`, since)
})

test("the customer follows the parcel on the order screen; the dispatcher closes it", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: STORE, query: opened(order) })
    await expect(page.getByText("Dispetcher: Jasur")).toBeVisible()
    await expect(page.getByText("Pochta orqali jo'natildi")).toBeVisible()
    const notes = page.locator("[data-delivery-notes]")
    // Newest first, like a parcel's tracking.
    await expect(notes.locator("li").first()).toContainText("Qarshiga yetdi")
    await expect(notes).toContainText("Trek: UZ123456")
    await expect(page.getByRole("link", { name: /Dispetcherga qo'ng'iroq/ })).toBeVisible()
    await expect(page.getByText("alohida", { exact: true })).toBeVisible()

    const delivered = await apiAs(PEOPLE.courier, `/courier/orders/${order.id}`, {
        courierBot: true,
        method: "PATCH",
        json: { status: "delivered" },
    })
    expect(delivered.status).toBe(200)
})

test("«O'zim yetkazaman» takes it back from the dispatcher: the old steps return", async ({
    page,
}) => {
    const next = await placeOrder(PEOPLE.customer, STORE, [
        { productId: "dev-store-p1", quantity: 1 },
    ])
    expect((await payAndStart(PEOPLE.storeOwner, STORE, next.id)).status).toBe(200)
    await openApp(page, { user: PEOPLE.storeOwner, shop: STORE, query: opened(next) })
    const mine = card(page, next.number)
    await expect(mine.getByText("Dispetcher: Jasur")).toBeVisible()
    await mine.getByRole("button", { name: "Boshqa kuryer" }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByRole("button", { name: /Jasur · Dispetcher/ })).toBeVisible()
    await sheet.getByRole("button", { name: /O'zim yetkazaman/ }).click()
    await expect(mine.getByText("Dispetcher: Jasur")).toHaveCount(0)
    await mine.getByRole("button", { name: "Tayyor bo'ldi" }).click()
    await expect(mine.getByRole("button", { name: "Jo'natish" })).toBeVisible()
})
