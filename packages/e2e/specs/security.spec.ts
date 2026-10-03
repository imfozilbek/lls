/**
 * Security from the outside: forged or borrowed identities, other people's orders,
 * client-chosen prices and channels, webhooks without the secret, CORS.
 */
import { expect, test } from "@playwright/test"

import { WORKER_URL, platformBot, shopBySlug } from "../stand/config.js"
import {
    FOOD,
    GROCERY,
    PEOPLE,
    WATER,
    apiAs,
    placeOrder,
    resetStand,
    payAndAccept,
} from "../support/stand.js"
import { signInitData } from "../support/webapp.js"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

async function raw(
    path: string,
    headers: Record<string, string>,
    init: RequestInit = {},
): Promise<Response> {
    return fetch(`${WORKER_URL}${path}`, {
        ...init,
        headers: { Origin: "http://localhost:5173", ...headers },
    })
}

test("no initData, a broken signature or an old one: 401", async () => {
    expect((await raw("/api/shop", { "X-Shop": FOOD })).status).toBe(401)
    const signed = signInitData(PEOPLE.customer, shopBySlug(FOOD).bot.token)
    const tampered = signed.replace("Aziz", "Azim")
    expect(
        (await raw("/api/shop", { "X-Shop": FOOD, "X-Telegram-Init-Data": tampered })).status,
    ).toBe(401)
    const old = signInitData(PEOPLE.customer, shopBySlug(FOOD).bot.token, {
        auth_date: String(Math.floor(Date.now() / 1000) - 25 * 3600),
    })
    expect((await raw("/api/shop", { "X-Shop": FOOD, "X-Telegram-Init-Data": old })).status).toBe(
        401,
    )
})

test("the showcase channel cannot be claimed with a shop bot's signature", async () => {
    const response = await raw("/api/shop", {
        "X-Shop": FOOD,
        "X-Via": "marketplace",
        "X-Telegram-Init-Data": signInitData(PEOPLE.customer, shopBySlug(FOOD).bot.token),
    })
    expect(response.status).toBe(401)
    // And a shop outside the showcase cannot be opened through it.
    const water = await raw("/api/shop", {
        "X-Shop": WATER,
        "X-Via": "marketplace",
        "X-Telegram-Init-Data": signInitData(PEOPLE.customer, platformBot().token),
    })
    expect(water.status).toBe(404)
})

test("another customer's order is not found; another shop's order neither", async () => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    // Refused either way (ids are random UUIDs, so 403 reveals nothing useful).
    expect([403, 404]).toContain(
        (await apiAs(PEOPLE.stranger, `/orders/${order.id}`, { shop: FOOD })).status,
    )
    expect((await apiAs(PEOPLE.customer, `/orders/${order.id}`, { shop: GROCERY })).status).toBe(
        404,
    )
    // Another shop's owner cannot touch it either.
    const foreign = await payAndAccept(PEOPLE.groceryOwner, GROCERY, order.id)
    expect(foreign.status).toBe(404)
})

test("prices and totals come from the server; extra fields are ignored", async () => {
    const response = await apiAs(PEOPLE.customer, "/orders", {
        shop: FOOD,
        method: "POST",
        json: {
            items: [{ productId: "dev-food-p1", quantity: 1, price: 1 }],
            address: "Navoiy 1",
            total: 1,
            customerId: "someone-else",
        },
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ subtotal: 45_000, total: 55_000 })
})

test("a product of another shop cannot be ordered here", async () => {
    const response = await apiAs(PEOPLE.customer, "/orders", {
        shop: FOOD,
        method: "POST",
        json: { items: [{ productId: "dev-grocery-p1", quantity: 500 }], address: "Navoiy 1" },
    })
    expect([404, 422]).toContain(response.status)
})

test("webhooks need the secret; CORS allows only the Mini App", async () => {
    const bot = shopBySlug(FOOD).bot
    const update = { update_id: 1, message: { chat: { id: 1 }, from: { id: 1 }, text: "/start" } }
    const noSecret = await fetch(`${WORKER_URL}/tg/${bot.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
    })
    expect(noSecret.status).toBe(401)
    const otherSecret = await fetch(`${WORKER_URL}/tg/platform`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Telegram-Bot-Api-Secret-Token": bot.webhookSecret,
        },
        body: JSON.stringify(update),
    })
    expect(otherSecret.status).toBe(401)

    const evil = await fetch(`${WORKER_URL}/api/shop`, {
        method: "OPTIONS",
        headers: {
            Origin: "https://evil.example",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-telegram-init-data",
        },
    })
    expect(evil.headers.get("access-control-allow-origin")).toBeNull()
    const ours = await fetch(`${WORKER_URL}/api/shop`, {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "GET" },
    })
    expect(ours.headers.get("access-control-allow-origin")).toBe("http://localhost:5173")
})

test("no bot token ever leaves the API", async () => {
    const owner = await apiAs(PEOPLE.foodOwner, "/owner/shop", { shop: FOOD })
    const text = await owner.text()
    expect(text).not.toContain(shopBySlug(FOOD).bot.token)
    expect(text).not.toMatch(/token|webhook_?secret/i)
})
