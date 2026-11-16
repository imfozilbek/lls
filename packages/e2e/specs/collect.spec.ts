/**
 * Collecting is a step of its own (owner's decision, November 2026): «Pul keldi» accepts the
 * order, it waits in «Yig'ish kerak» until «Yig'ishni boshlash», and the customer hears both. A
 * service starts the moment it is accepted: there is nothing to collect.
 */
import { expect, test } from "@playwright/test"

import {
    GROCERY,
    PEOPLE,
    SERVICE,
    apiAs,
    placeOrder,
    resetStand,
    sendReceipt,
} from "../support/stand.js"
import { lastSeq, waitForMessage } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { TgUser } from "../support/telegram.js"
import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

/** The customer's screenshot, then the owner's «Pul keldi». */
async function pay(owner: TgUser, shop: string, orderId: string): Promise<{ status: string }> {
    expect((await sendReceipt(PEOPLE.customer, shop, orderId)).status).toBe(200)
    const paid = await apiAs(owner, `/owner/orders/${orderId}/payment`, {
        shop,
        method: "PATCH",
        json: { action: "paid" },
    })
    expect(paid.status).toBe(200)
    return (await paid.json()) as { status: string }
}

const card = (page: Page, number: number): ReturnType<Page["locator"]> =>
    page.locator("li").filter({ has: page.getByText(`Buyurtma #${number}`, { exact: true }) })

test("«Pul keldi» accepts; «Yig'ish kerak» until «Yig'ishni boshlash»; two messages", async ({
    page,
}) => {
    const line = [{ productId: "dev-grocery-p1", quantity: 2000 }]
    await placeOrder(PEOPLE.customer, GROCERY, line)
    const order = await placeOrder(PEOPLE.customer, GROCERY, line)
    const since = await lastSeq()
    expect(await pay(PEOPLE.groceryOwner, GROCERY, order.id)).toMatchObject({ status: "accepted" })
    const accepted = await waitForMessage(PEOPLE.customer.id, "qabul qilindi", since)
    expect(accepted.text).toContain("To'lovingiz keldi")
    expect(accepted.text).not.toContain("yig'ilmoqda")

    // The customer: taken, the work not under way yet.
    await openApp(page, {
        user: PEOPLE.customer,
        shop: GROCERY,
        query: `?shop=${GROCERY}&order=${order.id}`,
    })
    await expect(page.getByRole("heading", { name: "Qabul qilindi" })).toBeVisible()

    // The owner: a new order and one to collect, each under its chip.
    await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    const chips = page.getByRole("group", { name: "Buyurtma holati" })
    await chips.getByRole("button", { name: /^Yig'ish kerak/ }).click()
    const one = card(page, order.number)
    await expect(one).toContainText("Yig'ish kerak")
    const started = await lastSeq()
    await one.getByRole("button", { name: "Yig'ishni boshlash", exact: true }).click()
    const collecting = await waitForMessage(PEOPLE.customer.id, "hozir yig'ilmoqda", started)
    // The money was told with «qabul qilindi»: once.
    expect(collecting.text).not.toContain("To'lovingiz keldi")
    await chips.getByRole("button", { name: /^Yig'ilmoqda/ }).click()
    await expect(card(page, order.number)).toBeVisible()
})

test("a service starts the moment it is accepted: one message", async () => {
    const order = await placeOrder(PEOPLE.customer, SERVICE, [
        { productId: "dev-service-p1", quantity: 10 },
    ])
    const since = await lastSeq()
    expect(await pay(PEOPLE.serviceOwner, SERVICE, order.id)).toMatchObject({
        status: "preparing",
    })
    const told = await waitForMessage(PEOPLE.customer.id, "qabul qilindi va bajarilmoqda", since)
    expect(told.text).toContain("To'lovingiz keldi")
})
