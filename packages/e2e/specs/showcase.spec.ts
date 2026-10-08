/**
 * The Zumda showcase: search across shops in the Zumda bot, open a shop there, order with the
 * marketplace channel and commission; the admin signs and ends showcase deals.
 */
import { expect, test } from "@playwright/test"

import { businessBot, platformBot } from "../stand/config.js"
import { FOOD, PEOPLE, WATER, apiAs, resetStand, payAndAccept } from "../support/stand.js"
import {
    businessChat,
    callsOf,
    lastSeq,
    platformChat,
    waitForMessage,
} from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

const search = (page: Page): ReturnType<Page["getByRole"]> =>
    page.getByRole("textbox", { name: "Mahsulot qidirish" })

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("the Zumda bot greets customers with the instruction video and the showcase", async () => {
    const since = await lastSeq()
    await platformChat().send(PEOPLE.customer, "/start")
    const welcome = await waitForMessage(PEOPLE.customer.id, "oshxonalar va xizmatlar", since)
    expect(welcome.token).toBe(platformBot().token)
    expect(welcome.method).toBe("sendVideo")
    expect(welcome.video).toBe("http://localhost:5173/welcome/zumda.mp4")
    // The Mini App serves the video and its cover: Telegram downloads them from there.
    const video = await fetch(welcome.video ?? "")
    expect(video.headers.get("content-type")).toBe("video/mp4")
    const [call] = await callsOf("sendVideo", since)
    const cover = await fetch(String(call?.body["cover"]))
    expect(cover.headers.get("content-type")).toBe("image/jpeg")
    expect(welcome.buttons.map((b) => b.web_app?.url)).toEqual([
        "http://localhost:5173/?mode=market",
    ])
})

test("Zumda Business greets owners with «Mening bizneslarim»", async () => {
    const since = await lastSeq()
    await businessChat().send(PEOPLE.newOwner, "/start")
    const welcome = await waitForMessage(PEOPLE.newOwner.id, "Zumda Business", since)
    expect(welcome.token).toBe(businessBot().token)
    expect(welcome.video).toBe("http://localhost:5173/welcome/biznes.mp4")
    expect(welcome.buttons.map((b) => b.web_app?.url)).toEqual([
        "http://localhost:5173/?mode=business",
    ])
})

test("shops with a deal are listed; search works in Latin and Cyrillic", async ({ page }) => {
    await openApp(page, { user: PEOPLE.customer, query: "?mode=market" })
    await expect(page.getByRole("heading", { name: "Tumaningiz do'konlari" })).toBeVisible()
    await expect(page.getByText("Do'konlar · 3")).toBeVisible()
    await expect(page.getByRole("button", { name: /Osh Markaz/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Baraka Market/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Uy Bozori/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Toza Suv/ })).toBeHidden()

    await search(page).fill("ош")
    await expect(page.getByRole("button", { name: /To'y oshi/ })).toBeVisible()
    await search(page).fill("помидор")
    await expect(page.getByRole("button", { name: /Pomidor/ })).toBeVisible()
    await search(page).fill("suv")
    // Water is not in the showcase: its products are not found.
    await expect(page.getByText("Hech narsa topilmadi")).toBeVisible()
    await page.getByRole("button", { name: "Tozalash" }).click()
    await expect(page.getByText("Do'konlar · 3")).toBeVisible()

    await page.getByRole("button", { name: "Sho'rvalar" }).click()
    // The products (name, then price): the category chips carry dish names too («Lag'mon, manti...»).
    await expect(page.getByRole("button", { name: /^Lag'mon \d/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /^To'y oshi \d/ })).toBeHidden()
})

test("a product opens its shop inside the Zumda bot; Back returns to the search", async ({
    page,
}) => {
    const app = await openApp(page, { user: PEOPLE.foodOwner, query: "?mode=market" })
    // Each step waits for what it needs, so a stall names itself instead of a 1-minute timeout.
    await expect(search(page)).toBeVisible()
    await search(page).fill("oshi")
    const product = page.getByRole("button", { name: /To'y oshi/ })
    await expect(product).toBeVisible()
    await product.click()
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    // The shop opens on the dish that was tapped, not at its top.
    await expect(
        page.locator('[id^="product-"]').filter({ hasText: "To'y oshi" }).first(),
    ).toBeInViewport()
    // Owner screens never open through the showcase.
    await expect(page.getByRole("button", { name: "Mening do'konim" })).toBeHidden()
    await app.back()
    await expect(page.getByRole("heading", { name: "Tumaningiz do'konlari" })).toBeVisible()
})

test("an order through the showcase: commission for Zumda, Zumda bot tells the customer", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, query: "?mode=market" })
    await page.getByRole("button", { name: /Osh Markaz/ }).click()
    await page.getByRole("button", { name: "Qo'shish: To'y oshi" }).click()
    await bottomButton(page).click()
    await bottomButton(page).click()
    await page.getByRole("button", { name: "Raqamni yuborish" }).click()
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible({ timeout: 20_000 })
    await page.getByRole("textbox", { name: "Manzil" }).fill("Navoiy 7")
    const since = await lastSeq()
    await bottomButton(page).click()
    await expect(page.getByRole("heading", { name: "Buyurtma yuborildi!" })).toBeVisible()

    // The owner's card comes from the shop's own bot and shows the commission (5% of 45 000).
    const card = await waitForMessage(PEOPLE.foodOwner.id, "#1", since)
    expect(card.token).toContain("100200300:")
    expect(card.text).toMatch(/Zumda vitrinasidan · komissiya 5%: 2\s250/)

    const orders = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/orders?status=active", { shop: FOOD })
    ).json()) as { data: { id: string; channel: string; commission: number }[] }
    expect(orders.data[0]).toMatchObject({ channel: "marketplace", commission: 2_250 })
    const before = await lastSeq()
    await payAndAccept(PEOPLE.foodOwner, FOOD, orders.data[0]?.id ?? "")
    const told = await waitForMessage(PEOPLE.customer.id, "qabul qilindi", before)
    expect(told.token).toBe(platformBot().token)
    expect(told.text).toContain("Osh Markaz")

    // The owner sees the Zumda mark on the order in «Мой магазин».
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await expect(page.getByText(/Zumda vitrinasidan · komissiya 2\s250/)).toBeVisible()
})

test("orders through the shop's own bot carry no commission", async () => {
    const response = await apiAs(PEOPLE.customer, "/orders", {
        shop: FOOD,
        method: "POST",
        json: {
            items: [{ productId: "dev-food-p1", quantity: 1 }],
            address: "Navoiy 7",
            channel: "marketplace",
        },
    })
    // The showcase order handed the phone to this shop, so its own bot can take the order;
    // the client asked for "marketplace", but the signing bot decides: no commission.
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ channel: "shop_bot", commission: 0 })
})

test("the admin adds and removes a shop in «Platforma»; others cannot", async ({ page }) => {
    const since = await lastSeq()
    const live = (await (
        await apiAs(PEOPLE.admin, "/admin/shops?status=active", { businessBot: true })
    ).json()) as { data: { id: string; slug: string }[] }
    const water = live.data.find((shop) => shop.slug === WATER)?.id ?? ""
    const forged = await apiAs(PEOPLE.waterOwner, `/admin/shops/${water}/marketplace`, {
        businessBot: true,
        method: "PUT",
        json: { percent: 0 },
    })
    expect(forged.status).toBe(403)

    await openApp(page, { user: PEOPLE.admin, businessBot: true })
    await page.getByRole("button", { name: /Platforma/ }).click()
    await page.getByRole("tab", { name: "Bizneslar" }).click()
    const card = page.getByRole("listitem").filter({ hasText: "Toza Suv" })
    await card.getByRole("switch", { name: "Zumda vitrinasida" }).click()
    await card.getByLabel("Vitrina komissiyasi, %").fill("3")
    await card.getByRole("button", { name: "Saqlash" }).click()
    await expect(page.getByText("Vitrina saqlandi")).toBeVisible()
    await waitForMessage(PEOPLE.waterOwner.id, "tovarlarning 3%", since)

    const shopper = await page.context().newPage()
    await openApp(shopper, { user: PEOPLE.customer, query: "?mode=market" })
    await expect(shopper.getByText("Do'konlar · 4")).toBeVisible()

    await card.getByRole("switch", { name: "Zumda vitrinasida" }).click()
    await expect(page.getByText("Vitrinadan olindi")).toBeVisible()
    await waitForMessage(PEOPLE.waterOwner.id, "vitrinasidan olindi", since)
    await shopper.reload()
    await expect(shopper.getByText("Do'konlar · 3")).toBeVisible()
})

test("search is rate-limited per person", async ({ page }) => {
    // A fresh person per run: the limiter keeps its minute across repeated runs of this test.
    const person = { ...PEOPLE.newOwner, id: 500_000 + Math.floor(Math.random() * 400_000) }
    const statuses: number[] = []
    for (let i = 0; i < 31; i++) {
        statuses.push((await apiAs(person, "/showcase/products?q=osh")).status)
    }
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
    await openApp(page, { user: person, query: "?mode=market" })
    await search(page).fill("osh")
    await expect(
        page.getByText("Juda ko'p so'rov. Bir daqiqadan keyin qayta urinib ko'ring."),
    ).toBeVisible()
})
