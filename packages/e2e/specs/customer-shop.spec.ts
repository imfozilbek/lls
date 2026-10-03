/**
 * Customer of a shop's own bot: open → browse → cart → order → track → cancel → history.
 */
import { expect, test } from "@playwright/test"

import { FOOD, GROCERY, PEOPLE, WATER, apiAs, resetStand } from "../support/stand.js"
import { lastSeq, messagesTo, shopChat, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const money = (digits: string): RegExp => new RegExp(digits.replace(" ", "\\s?"))

async function add(page: Page, name: string, times = 1): Promise<void> {
    await page.getByRole("button", { name: `Qo'shish: ${name}` }).click()
    for (let i = 1; i < times; i++) {
        await page
            .getByRole("group", { name })
            .getByRole("button", { name: "Ko'paytirish" })
            .click()
    }
}

async function checkout(page: Page, address = "Mustaqillik 5"): Promise<void> {
    await bottomButton(page).click() // cart
    await bottomButton(page).click() // checkout
    await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()
    // The phone is asked only once: Telegram already gave it to this shop.
    const share = page.getByRole("button", { name: "Raqamni yuborish" })
    if (await share.isVisible()) {
        await share.click()
    }
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
    await page.getByRole("textbox", { name: "Manzil" }).fill(address)
}

test.describe.configure({ mode: "serial" })

test.describe("customer of a food shop", () => {
    test.beforeAll(resetStand)

    test("the shop bot greets with a button that opens the storefront", async () => {
        const since = await lastSeq()
        await shopChat(FOOD).send(PEOPLE.customer, "/start")
        const welcome = await waitForMessage(PEOPLE.customer.id, "Osh Markaz", since)
        expect(welcome.buttons[0]?.web_app?.url).toBe(`http://localhost:5173/?shop=${FOOD}`)
    })

    test("storefront: brand, facts, categories, cart nudges and minimum order", async ({
        page,
    }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
        await expect(page.getByText(/Yetkazish 10\s000/)).toBeVisible()
        await expect(page.getByText(/Minimal 40\s000/)).toBeVisible()
        await expect(page.getByText("Ochiq")).toBeVisible()

        // Categories filter the menu.
        await page.getByRole("button", { name: "Sho'rvalar" }).click()
        await expect(page.getByRole("heading", { name: "Lag'mon" })).toBeVisible()
        await expect(page.getByRole("heading", { name: "To'y oshi" })).toBeHidden()
        await page.getByRole("button", { name: "Hammasi", exact: true }).click()

        await add(page, "Somsa tandir", 2)
        // The button counts positions, not pieces (kg items would show grams otherwise).
        await expect(bottomButton(page)).toContainText(/Savat · 1 · 16\s000/)
        await bottomButton(page).click()

        await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
        await expect(page.getByText(/Minimal buyurtmagacha yana 24\s000/)).toBeVisible()
        await expect(bottomButton(page)).toBeDisabled()

        // Remove one, then reach the minimum with a main dish.
        await page
            .getByRole("group", { name: "Somsa tandir" })
            .getByRole("button", { name: "Kamaytirish" })
            .click()
        await expect(page.getByText(/Minimal buyurtmagacha yana 32\s000/)).toBeVisible()
        await page
            .getByRole("group", { name: "Somsa tandir" })
            .getByRole("button", { name: "Kamaytirish" })
            .click()
        await expect(page.getByText("Savat bo'sh")).toBeVisible()
        await page.getByRole("button", { name: "Menyuga" }).click()
        await add(page, "To'y oshi")
        await bottomButton(page).click()
        await expect(page.getByText(/Bepul yetkazishgacha yana 105\s000/)).toBeVisible()
        await expect(bottomButton(page)).toBeEnabled()
        await expect(bottomButton(page)).toContainText(money("55 000"))
    })
})

test.describe("customer of a food shop: order and status", () => {
    test("order in a few taps: phone from Telegram, address, landmark, location", async ({
        page,
    }) => {
        const app = await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await add(page, "To'y oshi")
        await bottomButton(page).click()
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Buyurtma" })).toBeVisible()
        // Nothing to send yet: a tap says what is missing first.
        await bottomButton(page).click()
        await expect(page.getByText("Avval telefon raqamingizni yuboring")).toBeVisible()

        await page.getByRole("button", { name: "Raqamni yuborish" }).click()
        await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
        await page.getByRole("textbox", { name: "Manzil" }).fill("Mustaqillik 5")
        await page.getByLabel("Mo'ljal").fill("maktab yonida, ko'k darvoza")
        await page.getByRole("button", { name: "Joylashuvni yuborish" }).click()
        await expect(page.getByText("Joylashuv qo'shildi")).toBeVisible()
        await page.getByLabel("Izoh").fill("3-qavat")
        // Only a transfer to the shop's card (the whole path is covered in money.spec).
        await expect(page.getByRole("heading", { name: "O'tkazma orqali to'lov" })).toBeVisible()

        const since = await lastSeq()
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toBeVisible()
        await expect(page.getByRole("heading", { name: "Buyurtma #1" })).toBeVisible()
        await expect(page.getByText("maktab yonida, ko'k darvoza")).toBeVisible()
        const asked = (await app.calls()).map((c) => c.method)
        expect(asked).toContain("requestContact")
        expect(asked).toContain("requestWriteAccess")

        // The owner gets the order card from the shop bot, with the next step and "cancel".
        const card = await waitForMessage(PEOPLE.foodOwner.id, "#1", since)
        expect(card.text).toContain("To'y oshi")
        expect(card.text).toContain("Mustaqillik 5")
        expect(card.text).toContain("maktab yonida")
        expect(card.text).toContain("3-qavat")
        expect(card.text).toContain("+998 90 123 45 67")
        expect(card.buttons.map((b) => b.callback_data)).toEqual(
            expect.arrayContaining([expect.stringMatching(/^p:/), expect.stringMatching(/^x:/)]),
        )
        // "To menu" after placing.
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    })

    test("the money came, the owner accepts in the chat; the customer can no longer cancel", async ({
        page,
    }) => {
        const card = (await messagesTo(PEOPLE.foodOwner.id)).find((m) => m.text.includes("#1"))
        const accept = card?.buttons.find((b) => b.callback_data?.startsWith("p:"))
        expect(accept?.text).toBe("💳 Pul keldi, qabul qilish")
        const since = await lastSeq()
        await shopChat(FOOD).press(PEOPLE.foodOwner, accept?.callback_data ?? "")
        // «Pul keldi» asks first, with the sum and the card; «Ha» confirms.
        const question = await waitForMessage(PEOPLE.foodOwner.id, "keldimi?", since)
        const yes = question.buttons.find((b) => b.callback_data?.startsWith("pc:"))
        await shopChat(FOOD).press(PEOPLE.foodOwner, yes?.callback_data ?? "")
        await waitForMessage(
            PEOPLE.customer.id,
            "To'lov keldi, #1 buyurtmangiz qabul qilindi",
            since,
        )

        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: "Buyurtmalarim" }).click()
        await page.getByRole("button", { name: /Buyurtma #1/ }).click()
        await expect(page.getByRole("heading", { name: "Qabul qilindi" })).toBeVisible()
        await expect(page.getByRole("button", { name: "Buyurtmani bekor qilish" })).toBeHidden()
    })
})

/** Continues with the orders placed above (the specs run in order). */
test.describe("customer of a food shop: cancel, history, Uzbek only", () => {
    test("the customer cancels while the order is new; the owner is told", async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await add(page, "To'y oshi")
        await checkout(page)
        await bottomButton(page).click()
        await expect(page.getByRole("heading", { name: "Buyurtma #2" })).toBeVisible()
        const since = await lastSeq()
        await page.getByRole("button", { name: "Buyurtmani bekor qilish" }).click()
        await expect(page.getByRole("heading", { name: "Bekor qilindi" })).toBeVisible()
        await waitForMessage(PEOPLE.foodOwner.id, "Mijoz buyurtmani bekor qildi", since)
    })

    test("history lists orders; a finished one is ordered again in one tap", async ({ page }) => {
        // Deliver order #1 through the owner's API.
        const orders = (await (
            await apiAs(PEOPLE.foodOwner, "/owner/orders?status=active", { shop: FOOD })
        ).json()) as {
            data: { id: string; number: number }[]
        }
        const first = orders.data.find((o) => o.number === 1)
        for (const status of ["preparing", "ready", "picked_up", "delivered"]) {
            const response = await apiAs(PEOPLE.foodOwner, `/owner/orders/${first?.id ?? ""}`, {
                shop: FOOD,
                method: "PATCH",
                json: { status },
            })
            expect(response.status).toBe(200)
        }
        await waitForMessage(PEOPLE.customer.id, "#1 buyurtmangiz yetkazildi")

        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await page.getByRole("button", { name: "Buyurtmalarim" }).click()
        await expect(page.getByRole("button", { name: /Buyurtma #2.*Bekor qilindi/ })).toBeVisible()
        await expect(page.getByRole("button", { name: /Buyurtma #1.*Yetkazildi/ })).toBeVisible()
        await page.getByRole("button", { name: "Takrorlash" }).first().click()
        await expect(page.getByRole("heading", { name: "Savat" })).toBeVisible()
        await expect(page.getByRole("group", { name: "To'y oshi" })).toContainText("1")
    })

    test("Uzbek only: no language switch, even for a customer whose Telegram is Russian", async ({
        page,
    }) => {
        await openApp(page, { user: PEOPLE.customer, shop: FOOD })
        await expect(page.getByRole("button", { name: "Buyurtmalarim" })).toBeVisible()
        await expect(page.getByRole("button", { name: "uz", exact: true })).toHaveCount(0)
        await expect(page.getByRole("button", { name: "ru", exact: true })).toHaveCount(0)
        expect(await page.evaluate(() => document.documentElement.lang)).toBe("uz")
        const me = await apiAs(PEOPLE.customer, "/me", { shop: FOOD })
        expect(((await me.json()) as { language: string }).language).toBe("uz")
        const russian = await apiAs(PEOPLE.customer, "/me", {
            shop: FOOD,
            method: "PATCH",
            json: { language: "ru" },
        })
        expect(russian.status).toBe(400)
    })
})

test.describe("customer of a water shop", () => {
    test.beforeAll(resetStand)

    test("empty bottles lower the deposit; the owner card shows them", async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: WATER })
        await expect(page.getByRole("heading", { name: "Toza Suv", exact: true })).toBeVisible()
        await add(page, "Toza suv 19 l", 2)
        await checkout(page)
        // Two bottles, none handed back yet: deposit 2 × 30 000.
        await expect(page.getByText("Idish garovi")).toBeVisible()
        await expect(page.getByText(money("60 000"))).toBeVisible()
        await page
            .getByRole("group", { name: "Bo'sh idishlar" })
            .getByRole("button", { name: "Ko'paytirish" })
            .click()
        await expect(page.getByText(money("30 000")).first()).toBeVisible()
        await expect(bottomButton(page)).toContainText(money("70 000"))
        const since = await lastSeq()
        await bottomButton(page).click()
        await expect(page.getByText("Qaytariladigan bo'sh idish: 1 ta")).toBeVisible()
        const card = await waitForMessage(PEOPLE.waterOwner.id, "#1", since)
        expect(card.text).toContain("Bo'sh idish qaytaradi: 1 ta")
    })
})

test.describe("customer of a grocery", () => {
    test.beforeAll(resetStand)

    test("weight items go by the shop's step; the price follows the grams", async ({ page }) => {
        await openApp(page, { user: PEOPLE.customer, shop: GROCERY })
        await add(page, "Pomidor", 3)
        await expect(page.getByRole("group", { name: "Pomidor" })).toContainText("1,5 kg")
        await add(page, "Mol go'shti")
        await expect(page.getByRole("group", { name: "Mol go'shti" })).toContainText("0,25 kg")
        await bottomButton(page).click()
        // 1.5 kg × 12 000 + 0.25 kg × 95 000 = 18 000 + 23 750
        await expect(page.getByText(money("41 750")).first()).toBeVisible()
        await bottomButton(page).click()
        await page.getByRole("button", { name: "Raqamni yuborish" }).click()
        await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
        await page.getByRole("textbox", { name: "Manzil" }).fill("Navoiy 1")
        const since = await lastSeq()
        await bottomButton(page).click()
        await expect(page.getByText("Pomidor")).toBeVisible()
        const card = await waitForMessage(PEOPLE.groceryOwner.id, "#1", since)
        expect(card.text).toContain("1,5 kg")
    })
})
