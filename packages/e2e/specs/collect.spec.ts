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

interface ShelfProduct {
    id: string
    name: string
    step: number
    isAvailable: boolean
    options?: unknown
    unavailableUntil?: string
}

/** Four plain lines of the grocery: the kilos of the first one carry the shop's minimum. */
async function fourLines(): Promise<{ productId: string; quantity: number; name: string }[]> {
    const shelf = (
        (await (await apiAs(PEOPLE.customer, "/shop/products", { shop: GROCERY })).json()) as {
            data: ShelfProduct[]
        }
    ).data.filter((p) => p.isAvailable && !p.options && !p.unavailableUntil)
    const first = shelf.find((p) => p.id === "dev-grocery-p1")
    const others = shelf.filter((p) => p.id !== "dev-grocery-p1").slice(0, 3)
    if (!first || others.length < 3) {
        throw new Error("the stand's grocery has fewer than four plain products")
    }
    return [
        { productId: first.id, quantity: 2000, name: first.name },
        ...others.map((p) => ({ productId: p.id, quantity: p.step, name: p.name })),
    ]
}

/** The owner's orders under one chip. */
async function ownerStage(page: Page, stage: RegExp): Promise<void> {
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page
        .getByRole("group", { name: "Buyurtma holati" })
        .getByRole("button", { name: stage })
        .click()
}

const statusOf = async (orderId: string): Promise<string> =>
    (
        (await (
            await apiAs(PEOPLE.groceryOwner, `/orders/${orderId}`, { shop: GROCERY })
        ).json()) as { status: string }
    ).status

test("every line while collecting, ticks kept on this phone, «Tayyor» asks while some are left", async ({
    page,
}) => {
    const lines = await fourLines()
    const order = await placeOrder(
        PEOPLE.customer,
        GROCERY,
        lines.map(({ productId, quantity }) => ({ productId, quantity })),
        { comment: "Piyozsiz, iltimos" },
    )
    await pay(PEOPLE.groceryOwner, GROCERY, order.id)
    // «O'zim yetkazaman» first: once collected, «Tayyor bo'ldi» is the next step.
    const self = await apiAs(PEOPLE.groceryOwner, `/owner/orders/${order.id}/courier`, {
        shop: GROCERY,
        method: "PUT",
        json: { self: true },
    })
    expect(self.status).toBe(200)

    // «Yig'ish kerak»: every line and the customer's words, without «Batafsil» or «Yana».
    await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY, confirm: false })
    await ownerStage(page, /^Yig'ish kerak/)
    const queued = card(page, order.number)
    for (const line of lines) {
        await expect(queued).toContainText(line.name)
    }
    await expect(queued.getByText("Mijozning iltimosi")).toBeVisible()
    await expect(queued.getByText("Piyozsiz, iltimos")).toBeVisible()
    await expect(queued.getByRole("button", { name: /^Yana / })).toHaveCount(0)
    await expect(queued.getByRole("checkbox")).toHaveCount(0)
    await queued.getByRole("button", { name: "Yig'ishni boshlash", exact: true }).click()

    // «Yig'ilmoqda»: each line is a tick.
    await page
        .getByRole("group", { name: "Buyurtma holati" })
        .getByRole("button", { name: /^Yig'ilmoqda/ })
        .click()
    const collecting = card(page, order.number)
    const ticks = collecting.getByRole("checkbox")
    await expect(ticks).toHaveCount(4)
    await ticks.nth(0).click()
    await ticks.nth(1).click()
    await expect(collecting).toContainText("Yig'ildi: 2 / 4")

    // Closed and opened again on this phone: the ticks are still there.
    const app = await openApp(page, { user: PEOPLE.groceryOwner, shop: GROCERY, confirm: false })
    await ownerStage(page, /^Yig'ilmoqda/)
    await expect(ticks.nth(0)).toHaveAttribute("aria-checked", "true")
    await expect(ticks.nth(1)).toHaveAttribute("aria-checked", "true")
    await expect(ticks.nth(2)).toHaveAttribute("aria-checked", "false")

    // «Tayyor bo'ldi» with two left asks once; «Yo'q» keeps collecting.
    await collecting.getByRole("button", { name: "Tayyor bo'ldi" }).click()
    await expect
        .poll(async () => (await app.calls()).filter((c) => c.method === "showPopup").length)
        .toBe(1)
    const asked = (await app.calls()).filter((c) => c.method === "showPopup").at(-1)
    expect((asked?.args[0] as { message: string }).message).toBe(
        "2 ta mahsulot hali belgilanmagan. Buyurtma tayyormi?",
    )
    expect(await statusOf(order.id)).toBe("preparing")

    // Everything ticked: «Hammasi yig'ildi», and «Tayyor» goes without a question.
    await ticks.nth(2).click()
    await ticks.nth(3).click()
    await expect(collecting).toContainText("Hammasi yig'ildi")
    await collecting.getByRole("button", { name: "Tayyor bo'ldi" }).click()
    await expect.poll(() => statusOf(order.id)).toBe("ready")
    expect((await app.calls()).filter((c) => c.method === "showPopup")).toHaveLength(1)
})

test("a service lists its lines while it is done, with nothing to tick", async ({ page }) => {
    const order = await placeOrder(
        PEOPLE.customer,
        SERVICE,
        [{ productId: "dev-service-p1", quantity: 10 }],
        { comment: "Soat 17 dan keyin" },
    )
    expect(await pay(PEOPLE.serviceOwner, SERVICE, order.id)).toMatchObject({
        status: "preparing",
    })
    await openApp(page, { user: PEOPLE.serviceOwner, shop: SERVICE })
    await page.getByRole("button", { name: /^Mening/ }).click()
    const one = card(page, order.number)
    await expect(one.getByText("Soat 17 dan keyin")).toBeVisible()
    await expect(one.getByRole("checkbox")).toHaveCount(0)
})
