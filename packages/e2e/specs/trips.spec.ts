/**
 * Trips: several orders going one way, one courier, stops in order, the way on the map.
 * The stand's OpenRouteService is fake: its way turns at right angles, like streets.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, apiAs, payAndAccept, placeOrder, resetStand } from "../support/stand.js"
import { botCalls, lastSeq, waitForMessage } from "../support/telegram.js"
import { openApp } from "../support/webapp.js"

import type { Page } from "@playwright/test"

/** The food shop of the stand (Yakkabog'): its customers live north of it. */
const SHOP = { latitude: 38.9801, longitude: 66.6842 }
const north = (km: number): { latitude: number; longitude: number } => ({
    latitude: SHOP.latitude + km / 111.32,
    longitude: SHOP.longitude,
})

const ids: string[] = []
const numbers: number[] = []

async function ownerOrders(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await page.getByRole("tab", { name: "Buyurtmalar" }).click()
}

async function setStatus(id: string, status: string): Promise<void> {
    const response = await apiAs(PEOPLE.foodOwner, `/owner/orders/${id}`, {
        shop: FOOD,
        method: "PATCH",
        json: { status },
    })
    expect(response.status, await response.clone().text()).toBe(200)
}

test.describe.configure({ mode: "serial" })

// What the page itself says when something breaks: CI keeps only the log.
test.beforeEach(({ page }) => {
    page.on("pageerror", (error) => console.error(`pageerror: ${error.message}`))
    page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") {
            console.error(`console.${message.type()}: ${message.text()}`)
        }
    })
})

test.afterEach(async ({ page }, info) => {
    if (info.status !== info.expectedStatus) {
        const text = await page.evaluate(() => document.body.innerText).catch(() => "")
        console.error(`page text at failure:\n${text.slice(0, 2000)}`)
    }
})

test.beforeAll(async () => {
    await resetStand()
    // Far, near, middle: Zumda puts them near → middle → far.
    for (const km of [1.5, 0.5, 1]) {
        const order = await placeOrder(
            PEOPLE.customer,
            FOOD,
            [{ productId: "dev-food-p1", quantity: 2 }],
            { location: north(km) },
        )
        expect((await payAndAccept(PEOPLE.foodOwner, FOOD, order.id)).status).toBe(200)
        ids.push(order.id)
        numbers.push(order.number)
    }
})

test("the owner gives three orders one way to one courier, in Zumda's order", async ({ page }) => {
    await ownerOrders(page)
    await page.getByRole("button", { name: "Shu yo'nalishda yana 2 ta" }).first().click()
    const sheet = page.getByRole("dialog", { name: "Bir yo'nalish" })
    await expect(sheet).toBeVisible()
    const stops = sheet.locator("[data-stop]")
    await expect(stops).toHaveCount(3)
    // Nearest first: #2 (0.5 km), #3 (1 km), #1 (1.5 km).
    for (const [i, n] of [numbers[1], numbers[2], numbers[0]].entries()) {
        await expect(stops.nth(i)).toContainText(`#${n}`)
    }
    await expect(sheet.locator(".zumda-map")).toHaveAttribute("data-map-ready", "true", {
        timeout: 20_000,
    })
    await expect(sheet.locator('[data-marker="stop"]')).toHaveCount(3)
    await page.screenshot({ path: "screenshots/light/trip-sheet.png" })

    // The owner swaps the last two: #2 → #1 → #3.
    await stops.nth(1).getByRole("button", { name: "Pastga" }).click()
    await expect(stops.nth(1)).toContainText(`#${numbers[0]}`)
    await sheet.getByRole("radio", { name: "Jasur" }).click()
    const since = await lastSeq()
    await sheet.getByRole("button", { name: /Tayinlash · 3/ }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole("button", { name: /Yo'l · 1-manzil · 0\/3/ })).toBeVisible()

    // The way came from the road service: the shop first, then the stops in order.
    const ors = (await botCalls()).filter((c) => c.method === "ors" && c.seq > since)
    const asked = (ors[0]?.body as { coordinates: [number, number][] }).coordinates
    expect(asked.map(([, lat]) => lat.toFixed(4))).toEqual(
        [SHOP, north(0.5), north(1.5), north(1)].map((p) => p.latitude.toFixed(4)),
    )
    // One message to the courier with the order of the stops (sent after the answer).
    const order = `#${numbers[1]} → #${numbers[0]} → #${numbers[2]}`
    await waitForMessage(PEOPLE.courier.id, order, since)
})

test("the courier sees the way, takes all at once, delivers stop by stop", async ({ page }) => {
    await openApp(page, { user: PEOPLE.courier, shop: FOOD, courierBot: true })
    const trip = page.getByRole("listitem", { name: "Bir yo'nalish" })
    await expect(trip.getByRole("heading", { name: "3 ta buyurtma bir yo'nalishda" })).toBeVisible()
    const takeAll = trip.getByRole("button", { name: "Hammasini oldim" })
    await expect(takeAll).toBeDisabled()
    await expect(trip.getByText("Hammasi tayyor bo'lganda olasiz: 0/3 tayyor")).toBeVisible()

    // Yandex Navigator through every stop, in order.
    const link = await trip
        .getByRole("link", { name: "Yandex Navigatorda ochish" })
        .getAttribute("href")
    const route = new URL(link ?? "").searchParams.get("rtext") ?? ""
    expect(route.split("~").map((p) => p.split(",")[0]?.slice(0, 7))).toEqual([
        "",
        ...[north(0.5), north(1.5), north(1)].map((p) => p.latitude.toFixed(6).slice(0, 7)),
    ])

    for (const id of ids) {
        await setStatus(id, "preparing")
        await setStatus(id, "ready")
    }
    await page.reload()
    await expect(trip.locator(".zumda-map")).toHaveAttribute("data-map-ready", "true", {
        timeout: 20_000,
    })
    await expect(trip.locator('[data-marker="stop"][data-state="next"]')).toHaveCount(1)
    await page.screenshot({ path: "screenshots/light/trip-courier.png" })
    await trip.getByRole("button", { name: "Hammasini oldim" }).click()
    await expect(takeAll).toBeHidden()

    // Stop 1 first: its «Yetkazdim», then the next one is stop 2.
    const first = trip.locator('[data-stop="1"]')
    await first.getByRole("button", { name: /Yetkazdim/ }).click()
    await expect(first.getByText("Yetkazildi")).toBeHidden()
    await expect(trip.locator('[data-stop="2"]')).toContainText("Keyingi")
})

test("the owner sees which stops are delivered", async ({ page }) => {
    await ownerOrders(page)
    const line = page.getByRole("button", { name: /Yo'l · \d-manzil · 1\/3 yetkazildi/ }).first()
    await expect(line).toBeVisible()
    await line.click()
    const viewer = page.getByRole("dialog", { name: "Yo'lni ko'rish" })
    await expect(viewer.locator(".zumda-map")).toHaveAttribute("data-map-ready", "true", {
        timeout: 20_000,
    })
    await expect(viewer.locator('[data-marker="stop"][data-state="done"]')).toHaveCount(1)
    await expect(viewer.getByText("Yetkazildi")).toBeVisible()
    await page.screenshot({ path: "screenshots/light/trip-owner.png" })
})
