/**
 * Everyone on an order can call each other (owner's decision, October 2026): the owner sees the
 * customer's and the courier's numbers on the order card, the customer the courier's and the
 * shop's, the courier the customer's and the shop's. The shop's number is its own, or the owner's
 * while it has none. Every call is a `tel:` link with the digits on it.
 */
import { expect, test } from "@playwright/test"

import { runSql } from "../stand/seed.js"
import {
    FOOD,
    PEOPLE,
    apiAs,
    payAndAccept,
    placeOrder,
    resetStand,
    sendReceipt,
} from "../support/stand.js"
import { shopChat } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { PlacedOrder } from "../support/stand.js"

const CUSTOMER_TEL = "tel:+998901234567"
const COURIER_TEL = "tel:+998901112233"
const SHOP_TEL = "tel:+998901234501"
const OWNER_PHONE = "+998905550001"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

let order: PlacedOrder

/** Paid, accepted and given to the food shop's courier from the seed. */
test.beforeAll(async () => {
    order = await placeOrder(PEOPLE.customer, FOOD, [{ productId: "dev-food-p1", quantity: 1 }])
    expect((await sendReceipt(PEOPLE.customer, FOOD, order.id)).status).toBe(200)
    expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
    const assigned = await apiAs(PEOPLE.foodOwner, `/owner/orders/${order.id}/courier`, {
        shop: FOOD,
        method: "PUT",
        json: { courierId: "dev-food-courier" },
    })
    expect(assigned.status).toBe(200)
})

test("the owner's card: the customer's number and the courier's, each one tap", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    const customer = page.getByRole("link", { name: /^Qo'ng'iroq \+998/ })
    await expect(customer).toHaveAttribute("href", CUSTOMER_TEL)
    const courier = page.getByRole("link", { name: /^Kuryerga qo'ng'iroq/ })
    await expect(courier).toHaveAttribute("href", COURIER_TEL)
})

test("the customer: the courier and the shop on the order, the shop on the storefront", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    // The storefront: the shop is one tap away.
    const shopCall = page.getByRole("link", { name: "Qo'ng'iroq" })
    await expect(shopCall).toHaveAttribute("href", SHOP_TEL)
    // Telegram Android and the browser dial a plain tel: link (an iPhone: the next test).
    expect(await shopCall.getAttribute("target")).toBeNull()

    await openApp(page, {
        user: PEOPLE.customer,
        shop: FOOD,
        query: `?shop=${FOOD}&order=${order.id}`,
    })
    await expect(page.getByRole("link", { name: /Kuryerga qo'ng'iroq/ })).toHaveAttribute(
        "href",
        COURIER_TEL,
    )
    // Paid already: the shop's call is no longer only under the card.
    await expect(page.getByRole("link", { name: /Do'konga qo'ng'iroq/ })).toHaveAttribute(
        "href",
        SHOP_TEL,
    )
})

test("the courier: the customer's number and the shop's on the card", async ({ page }) => {
    await openApp(page, { user: PEOPLE.courier, courierBot: true })
    await expect(page.getByRole("link", { name: /Mijozga qo'ng'iroq/ })).toHaveAttribute(
        "href",
        CUSTOMER_TEL,
    )
    await expect(page.getByRole("link", { name: /Do'konga qo'ng'iroq/ })).toHaveAttribute(
        "href",
        SHOP_TEL,
    )
})

test("Telegram on an iPhone: a call opens a new window, so Telegram hands it to the phone", async ({
    page,
}) => {
    // The Mini App's own web view cannot dial a tel: link: the tap would do nothing.
    await openApp(page, { user: PEOPLE.customer, shop: FOOD, platform: "ios" })
    const shopCall = page.getByRole("link", { name: "Qo'ng'iroq" })
    await expect(shopCall).toHaveAttribute("href", SHOP_TEL)
    await expect(shopCall).toHaveAttribute("target", "_blank")

    await openApp(page, { user: PEOPLE.courier, courierBot: true, platform: "ios" })
    const customerCall = page.getByRole("link", { name: /Mijozga qo'ng'iroq/ })
    await expect(customerCall).toHaveAttribute("href", CUSTOMER_TEL)
    await expect(customerCall).toHaveAttribute("target", "_blank")
})

test("a shop without its own number: the owner's own phone stands in", async ({ page }) => {
    const cleared = await apiAs(PEOPLE.foodOwner, "/owner/shop", {
        shop: FOOD,
        method: "PATCH",
        json: { contactPhone: null },
    })
    expect(cleared.status).toBe(200)
    // The owner shares their own number with the shop's bot, as Telegram sends it.
    await shopChat(FOOD).shareContact(PEOPLE.foodOwner, OWNER_PHONE)

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute(
        "href",
        `tel:${OWNER_PHONE}`,
    )
})

test("a courier without a phone: the screen asks for it, the owner waits to approve", async ({
    page,
}) => {
    runSql("UPDATE courier_profiles SET phone = NULL WHERE telegram_id = 3003")
    const app = await openApp(page, {
        user: PEOPLE.courier,
        courierBot: true,
        contact: "share",
        phone: "+998901112233",
    })
    const card = page.getByRole("region", { name: "Raqamingizni yuboring" })
    await expect(card).toContainText("raqamsiz buyurtma kelmaydi")
    // Telegram sends the contact to the courier bot; the card goes once it lands.
    await card.getByRole("button", { name: "Raqamni yuborish" }).click()
    await expect(card).toBeHidden({ timeout: 20_000 })
    expect(await app.calls()).toContainEqual(expect.objectContaining({ method: "requestContact" }))
})
