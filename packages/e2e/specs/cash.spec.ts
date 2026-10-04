/**
 * Cash, chosen by the shop: «Karta», «Naqd» or «Ikkalasi». A cash order is accepted at once, goes
 * only with the shop's own courier, the courier takes the sum at the door and the owner marks
 * «Pulni oldim» per order. With both, the customer picks one and only its rules apply.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp, openSettings } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const P1 = "dev-food-p1"
const DISH = "To'y oshi"

interface Order {
    id: string
    number: number
    status: string
    payment: { method: string; status: string; withCourier: boolean }
}

async function owner(path: string, json?: object, method = "PATCH"): Promise<Response> {
    return apiAs(PEOPLE.foodOwner, path, { shop: FOOD, method, json })
}

const setOptions = (paymentOptions: string): Promise<Response> =>
    owner("/owner/shop", { paymentOptions })

async function openOwner(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
}

/** Menu → cart → checkout with the phone and the address filled in. */
async function toCheckout(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: `Qo'shish: ${DISH}` }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()
    const share = page.getByRole("button", { name: "Raqamni yuborish" })
    if (await share.isVisible()) {
        await share.click()
    }
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
    await page.getByRole("textbox", { name: "Manzil" }).fill("Mustaqillik 5")
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("the owner chooses «Naqd pul»: the cards step aside", async ({ page }) => {
    await openOwner(page)
    await openSettings(page, "To'lov")
    const options = page.getByRole("radiogroup", { name: "Mijoz qanday to'laydi" })
    await expect(options.getByRole("radio", { name: /Kartaga o'tkazma/ })).toHaveAttribute(
        "aria-checked",
        "true",
    )
    await expect(page.getByRole("button", { name: "Karta qo'shish" })).toBeVisible()
    await options.getByRole("radio", { name: /Naqd pul/ }).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    await expect(options.getByRole("radio", { name: /Naqd pul/ })).toHaveAttribute(
        "aria-checked",
        "true",
    )
    await expect(page.getByRole("button", { name: "Karta qo'shish" })).toHaveCount(0)
    await page.getByRole("button", { name: "Sozlamalar", exact: true }).click()
    await expect(page.getByRole("button").filter({ hasText: "Naqd pul" })).toBeVisible()
})

test("cash only: the customer sees the sum for the courier, no card, no «O'tkazdim»", async ({
    page,
}) => {
    await toCheckout(page)
    const pay = page.locator("section").filter({
        has: page.getByRole("heading", { name: "Naqd pul bilan to'lov" }),
    })
    await expect(pay).toContainText(/Yetkazganda kuryerga 55\s000\sso'm berasiz/)
    await expect(page.getByText("Kartaga o'tkazma")).toHaveCount(0)
    const since = await lastSeq()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toBeVisible()
    await expect(page.getByText(/Naqd: kuryerga 55\s000\sso'm berasiz/)).toBeVisible()
    await expect(bottomButton(page)).not.toContainText("O'tkazdim")
    await expect(page.getByText("8600 1234 5678 9012")).toHaveCount(0)
    const told = await waitForMessage(PEOPLE.customer.id, "To'lov naqd", since)
    expect(told.text).toMatch(/kuryerga.*55\s000/)
    const toOwner = await waitForMessage(PEOPLE.foodOwner.id, "Naqd: kuryer", since)
    expect(toOwner.buttons[0]?.callback_data).toMatch(/^a:.+:accepted$/)
})

test("the owner accepts without money; a cash order never goes to the network", async ({
    page,
}) => {
    await openOwner(page)
    const card = page.getByRole("listitem").filter({ hasText: "Naqd" }).first()
    await expect(card).toContainText("Yetkazganda to'lanadi")
    await expect(card.getByRole("button", { name: "Pul keldi, qabul qilish" })).toHaveCount(0)
    await card.getByRole("button", { name: "Qabul qilish" }).click()
    await expect(card.getByRole("button", { name: "Kuryer tayinlash" })).toBeVisible()
    await card.getByRole("button", { name: "Kuryer tayinlash" }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByRole("button", { name: /Jasur/ })).toBeVisible()
    await expect(sheet.getByText("Tuman tarmog'i kuryeri")).toHaveCount(0)
    await sheet.getByRole("button", { name: /Jasur/ }).click()
    await expect(card).toContainText("Jasur")
})

test("the courier takes the sum at the door and owes it to the shop", async ({ page }) => {
    const list = (await (
        await owner("/owner/orders?status=accepted", undefined, "GET")
    ).json()) as { data: Order[] }
    const order = list.data[0]
    expect(order?.payment.method).toBe("cash")
    const id = order?.id ?? ""
    await owner(`/owner/orders/${id}`, { status: "preparing" })
    await owner(`/owner/orders/${id}`, { status: "ready" })
    const picked = await apiAs(PEOPLE.courier, `/courier/orders/${id}`, {
        courierBot: true,
        method: "PATCH",
        json: { status: "picked_up" },
    })
    expect(picked.status).toBe(200)

    await openApp(page, { user: PEOPLE.courier, courierBot: true })
    await expect(page.getByText(/Mijozdan 55\s000\sso'm naqd oling/)).toBeVisible()
    const since = await lastSeq()
    await page.getByRole("button", { name: "Pulni oldim, yetkazdim" }).click()
    await expect(page.getByText(/Bugun yetkazilgan · 1/)).toBeVisible()
    await expect(page.getByText(/Do'konga topshirasiz: 55\s000\sso'm/)).toBeVisible()
    await waitForMessage(PEOPLE.customer.id, "yetkazildi", since)
})

test("«Pul»: the owner sees whose cash it is and takes it per order", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Pul" }).click()
    const cash = page.getByRole("region", { name: "Kuryerlardagi naqd pul" })
    await expect(cash).toContainText("Jasur")
    await expect(cash).toContainText(/55\s000/)
    await expect(page.getByText("Naqd pul").first()).toBeVisible()
    await cash.getByRole("button", { name: "Pulni oldim" }).click()
    await expect(page.getByText("Pul do'konda")).toBeVisible()
    await expect(cash).toBeHidden()
    const home = (await (
        await apiAs(PEOPLE.courier, "/courier/home", { courierBot: true })
    ).json()) as { shops: { businessId: string; cashToHand: number }[] }
    expect(home.shops.find((s) => s.businessId === "dev-food")?.cashToHand).toBe(0)
})

test("both: the customer picks cash or card, and only that way's rules apply", async ({ page }) => {
    expect((await setOptions("both")).status).toBe(200)
    await toCheckout(page)
    const methods = page.getByRole("radiogroup", { name: "To'lov usuli" })
    await expect(methods.getByRole("radio", { name: /Kartaga o'tkazma/ })).toHaveAttribute(
        "aria-checked",
        "true",
    )
    await methods.getByRole("radio", { name: /Naqd, kuryerga/ }).click()
    await expect(page.getByText(/Qaytim kerak bo'lsa/)).toBeVisible()
    await bottomButton(page).click()
    await expect(page.getByText(/Naqd: kuryerga 55\s000\sso'm berasiz/)).toBeVisible()

    const byCard = await placeOrder(PEOPLE.customer, FOOD, [{ productId: P1, quantity: 1 }])
    const read = (await (
        await apiAs(PEOPLE.customer, `/orders/${byCard.id}`, { shop: FOOD })
    ).json()) as Order
    expect(read.payment).toMatchObject({ method: "card_transfer", status: "unpaid" })
    // A transfer order still waits for the money.
    const early = await owner(`/owner/orders/${byCard.id}`, { status: "accepted" })
    expect(await early.json()).toMatchObject({ error: { code: "PAYMENT_REQUIRED" } })
})

test("card only: cash is refused", async () => {
    expect((await setOptions("card")).status).toBe(200)
    const refused = await apiAs(PEOPLE.customer, "/orders", {
        shop: FOOD,
        method: "POST",
        json: {
            items: [{ productId: P1, quantity: 1 }],
            address: "Navoiy 12",
            paymentMethod: "cash",
        },
    })
    expect(refused.status).toBe(422)
    expect(await refused.json()).toMatchObject({ error: { code: "PAYMENT_METHOD_UNAVAILABLE" } })
})
