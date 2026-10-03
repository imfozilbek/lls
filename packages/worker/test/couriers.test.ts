import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    COURIER_BOT,
    CUSTOMER,
    OTHER_BOT_TOKEN,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    hireCourier,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const COURIER = { id: 5005, first_name: "Jasur", language_code: "uz" }
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
const OTHER_OWNER = { id: 1002, first_name: "Dilshod", language_code: "ru" }
const OTHER_BOT = { id: 888000, username: "toza_suv_bot", firstName: "Toza" }

interface Json {
    id?: string
    [key: string]: unknown
}

interface Home {
    profile: { onShift: boolean; phone?: string }
    shops: { businessId: string; shopName: string; worksToday: boolean }[]
    orders: { id: string; status: string; shopName: string }[]
}

async function json<T = Json>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("shop couriers, verticals and channels", () => {
    let client: TestClient
    let slug: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const courierApp = (user: object = COURIER): ReturnType<TestClient["as"]> =>
        client.as(user, { courierBot: true })

    async function botUpdate(body: object): Promise<Response> {
        const row = await env.DB.prepare("SELECT webhook_secret FROM businesses WHERE bot_id = ?")
            .bind(SHOP_BOT.id)
            .first<{ webhook_secret: string }>()
        return client.request(`/tg/${SHOP_BOT.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [SECRET_HEADER]: row?.webhook_secret ?? "",
            },
            body: JSON.stringify(body),
        })
    }

    async function addProduct(body: object, owner = as(OWNER)): Promise<string> {
        const response = await owner("/api/owner/products", { method: "POST", json: body })
        expect(response.status).toBe(201)
        return (await json<{ id: string }>(response)).id
    }

    async function placeOrder(items: object[], extra: object = {}, shop = slug): Promise<Json> {
        const customer = client.as(CUSTOMER, {
            botToken: shop === slug ? SHOP_BOT_TOKEN : OTHER_BOT_TOKEN,
            shop,
        })
        await customer("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const response = await customer("/api/orders", {
            method: "POST",
            json: { items, address: "Navoiy 12", ...extra },
        })
        expect(response.status).toBe(201)
        return json(response)
    }

    /** "accepted" is «Деньги пришли, принять»: the shop starts only after the transfer. */
    const setStatus = (orderId: unknown, status: string, owner = as(OWNER)): Promise<Response> =>
        status === "accepted"
            ? owner(`/api/owner/orders/${String(orderId)}/payment`, {
                  method: "PATCH",
                  json: { action: "paid" },
              })
            : owner(`/api/owner/orders/${String(orderId)}`, { method: "PATCH", json: { status } })

    const assign = (orderId: unknown, courierId: string, owner = as(OWNER)): Promise<Response> =>
        owner(`/api/owner/orders/${String(orderId)}/courier`, {
            method: "PUT",
            json: { courierId },
        })

    const osh = (owner = as(OWNER)): Promise<string> =>
        addProduct({ name: "Osh", price: 35_000, unit: "portion", category: "meals" }, owner)

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT, [OTHER_BOT_TOKEN]: OTHER_BOT } })
        slug = (await createActiveShop(client)).slug
    })

    it("invite → accept in the courier bot → phone → the owner approves with a button", async () => {
        const response = await as(OWNER)("/api/owner/couriers/invites", { method: "POST" })
        expect(response.status).toBe(201)
        const { link } = await json<{ link: string }>(response)
        expect(link).toMatch(/^https:\/\/t\.me\/zumda_kuryer_bot\?start=c_[A-Za-z0-9_-]{16}$/)
        const code = link.split("start=")[1]

        await client.courierBot({
            message: { from: COURIER, chat: { id: COURIER.id }, text: `/start ${code}` },
        })
        const [waiting, toOwner] = client.telegram.sent.slice(-2)
        // The courier hears from the Zumda courier bot; the owner from their own shop bot.
        expect(waiting).toMatchObject({ chatId: COURIER.id, token: env.COURIER_BOT_TOKEN })
        expect(waiting?.options?.askContact).toBeTruthy()
        expect(toOwner).toMatchObject({ chatId: OWNER.id, token: SHOP_BOT_TOKEN })
        expect(toOwner?.html).toContain("Jasur")
        const approveButton = toOwner?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data
        expect(approveButton).toMatch(/^k:.+:approve$/)

        // Waiting for approval: listed for the owner, no courier screen yet.
        const [pending] = await json<{ id: string; status: string }[]>(
            await as(OWNER)("/api/owner/couriers"),
        )
        expect(pending?.status).toBe("pending")
        expect((await courierApp()("/api/courier/home")).status).toBe(403)

        // A forwarded contact never counts; their own does.
        await client.courierBot({
            message: {
                from: COURIER,
                chat: { id: COURIER.id },
                contact: { phone_number: "+998909998877", user_id: STRANGER.id },
            },
        })
        await client.courierBot({
            message: {
                from: COURIER,
                chat: { id: COURIER.id },
                contact: { phone_number: "+998901112233", user_id: COURIER.id },
            },
        })
        expect(client.telegram.sent.at(-1)?.options?.removeKeyboard).toBe(true)

        // A stranger pressing the owner's button gets nothing.
        await botUpdate({
            callback_query: { id: "cb-0", from: STRANGER, data: approveButton },
        })
        await botUpdate({
            callback_query: {
                id: "cb-1",
                from: OWNER,
                data: approveButton,
                message: { message_id: 7, chat: { id: OWNER.id } },
            },
        })
        expect(client.telegram.edited.at(-1)?.html).toContain("Jasur")
        const [approved, invite] = client.telegram.sent.slice(-2)
        expect(approved).toMatchObject({ chatId: COURIER.id, token: env.COURIER_BOT_TOKEN })
        expect(approved?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            "https://zumda-app.pages.dev/?mode=courier",
        )
        // Once, right after the first approval: the district network is offered.
        expect(invite).toMatchObject({ chatId: COURIER.id, token: env.COURIER_BOT_TOKEN })
        expect(invite?.options?.keyboard?.inline_keyboard[0]?.map((b) => b.callback_data)).toEqual([
            "net:join",
            "net:skip",
        ])
        const [courier] = await json<{ status: string; phone?: string }[]>(
            await as(OWNER)("/api/owner/couriers"),
        )
        expect(courier).toMatchObject({ status: "active", phone: "+998901112233" })

        // The same link does not work twice.
        await client.courierBot({
            message: { from: STRANGER, chat: { id: STRANGER.id }, text: `/start ${code}` },
        })
        expect(client.telegram.sent.at(-1)?.chatId).toBe(STRANGER.id)
        expect(await json<unknown[]>(await as(OWNER)("/api/owner/couriers"))).toHaveLength(1)
        // Couriers have no special role in the shop bot any more.
        expect(await json(await as(COURIER)("/api/shop"))).toMatchObject({ viewerRole: "customer" })
    })

    it("/start in the courier bot: unknown people get the how-to, couriers their shops", async () => {
        await client.courierBot({
            message: { from: STRANGER, chat: { id: STRANGER.id }, text: "/start" },
        })
        expect(client.telegram.sent.at(-1)?.html).toContain("taklif havolasini")
        await hireCourier(client, { slug }, COURIER)
        await client.courierBot({
            message: { from: COURIER, chat: { id: COURIER.id }, text: "/start" },
        })
        const home = client.telegram.sent.at(-1)
        expect(home?.html).toContain("Osh Markaz")
        expect(home?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
            "mode=courier",
        )
    })

    it("assign → card in the courier bot → ready ping → picked up → delivered", async () => {
        const courierId = await hireCourier(client, { slug }, COURIER)
        const order = await placeOrder([{ productId: await osh(), quantity: 2 }])
        expect(order).toMatchObject({ channel: "shop_bot", commission: 0, commissionBps: 0 })

        await setStatus(order.id, "accepted")
        const assigned = await assign(order.id, courierId)
        expect(await json(assigned)).toMatchObject({ courierName: "Jasur" })
        const card = client.telegram.sent.find(
            (m) => m.chatId === COURIER.id && m.html.includes("#1"),
        )
        expect(card?.token).toBe(env.COURIER_BOT_TOKEN)
        expect(card?.html).toContain("Osh Markaz")
        expect(card?.html).toContain("Navoiy 12")
        expect(card?.html).toContain("70 000")
        // Paid to the shop's card before cooking: nothing to take at the door.
        expect(card?.html).toContain("mijozdan pul olmang")
        expect(card?.options?.keyboard?.inline_keyboard).toHaveLength(0)

        await setStatus(order.id, "preparing")
        await setStatus(order.id, "ready")
        const edited = client.telegram.edited.filter((m) => m.chatId === COURIER.id).at(-1)
        expect(edited?.token).toBe(env.COURIER_BOT_TOKEN)
        expect(edited?.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data).toBe(
            `a:${String(order.id)}:picked_up`,
        )
        expect(
            client.telegram.sent.some((m) => m.chatId === COURIER.id && m.html.includes("tayyor")),
        ).toBe(true)

        const picked = await courierApp()(`/api/courier/orders/${String(order.id)}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        expect(picked.status).toBe(200)
        const toCustomer = client.telegram.sent.filter((m) => m.chatId === CUSTOMER.id).at(-1)
        expect(toCustomer?.html).toContain("Jasur")

        await client.courierBot({
            callback_query: {
                id: "cb-1",
                from: COURIER,
                data: `a:${String(order.id)}:delivered`,
            },
        })
        const home = await json<Home>(await courierApp()("/api/courier/home"))
        expect(home.orders[0]).toMatchObject({ status: "delivered", shopName: "Osh Markaz" })
        expect(home.shops[0]).not.toHaveProperty("onHand")
        expect(home.profile).toMatchObject({ onShift: true, phone: "+998901112233" })
    })

    it("a courier moves only their own orders and only the delivery part", async () => {
        await hireCourier(client, { slug }, COURIER)
        const order = await placeOrder([{ productId: await osh(), quantity: 2 }])
        await setStatus(order.id, "accepted")

        const notMine = await courierApp()(`/api/courier/orders/${String(order.id)}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        expect(notMine.status).toBe(403)
        const kitchenStep = await courierApp()(`/api/courier/orders/${String(order.id)}`, {
            method: "PATCH",
            json: { status: "preparing" },
        })
        expect(kitchenStep.status).toBe(400)
        // Not from the courier bot, or not a courier: no courier screen.
        expect((await as(COURIER)("/api/courier/home")).status).toBe(403)
        expect((await courierApp(CUSTOMER)("/api/courier/home")).status).toBe(403)
        expect((await courierApp()("/api/owner/orders")).status).toBe(400)
    })

    it("only a courier who works today and is on shift gets an order", async () => {
        const courierId = await hireCourier(client, { slug }, COURIER)
        const order = await placeOrder([{ productId: await osh(), quantity: 2 }])
        await setStatus(order.id, "accepted")

        const off = await as(OWNER)(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { offToday: true },
        })
        expect(await json(off)).toMatchObject({ offToday: true, unavailableReason: "off_today" })
        const refused = await assign(order.id, courierId)
        expect(refused.status).toBe(422)
        expect(await json(refused)).toMatchObject({
            error: { code: "COURIER_NOT_AVAILABLE", details: { reason: "off_today" } },
        })
        await as(OWNER)(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { offToday: false },
        })
        await courierApp()("/api/courier/shift", { method: "PUT", json: { onShift: false } })
        expect(await json(await assign(order.id, courierId))).toMatchObject({
            error: { details: { reason: "not_on_shift" } },
        })
        await courierApp()("/api/courier/shift", { method: "PUT", json: { onShift: true } })
        expect((await assign(order.id, courierId)).status).toBe(200)

        const badDays = await as(OWNER)(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { workDays: [] },
        })
        expect(badDays.status).toBe(400)
        const days = await as(OWNER)(`/api/owner/couriers/${courierId}`, {
            method: "PATCH",
            json: { workDays: ["sun", "mon"] },
        })
        expect(await json(days)).toMatchObject({ workDays: ["mon", "sun"] })
        const vehicle = await courierApp()("/api/courier/profile", {
            method: "PATCH",
            json: { vehicle: "Damas" },
        })
        expect(await json(vehicle)).toMatchObject({ vehicle: "Damas" })
    })

    it("one person, two shops: one bot, both shops' orders, each shop sees only its own", async () => {
        const water = await createActiveShop(client, {
            botToken: OTHER_BOT_TOKEN,
            name: "Toza Suv",
            owner: OTHER_OWNER,
        })
        const waterOwner = client.as(OTHER_OWNER, { botToken: OTHER_BOT_TOKEN, shop: water.slug })
        const inFood = await hireCourier(client, { slug }, COURIER)
        const inWater = await hireCourier(
            client,
            { slug: water.slug, botToken: OTHER_BOT_TOKEN, owner: OTHER_OWNER },
            COURIER,
        )
        expect(inFood).not.toBe(inWater)

        const food = await placeOrder([{ productId: await osh(), quantity: 2 }])
        const waterProduct = await addProduct(
            { name: "Suv", price: 15_000, unit: "pcs", category: "water" },
            waterOwner,
        )
        const bottle = await placeOrder([{ productId: waterProduct, quantity: 1 }], {}, water.slug)
        for (const [order, courierId, owner] of [
            [food, inFood, as(OWNER)],
            [bottle, inWater, waterOwner],
        ] as const) {
            await setStatus(order.id, "accepted", owner)
            expect((await assign(order.id, courierId, owner)).status).toBe(200)
            await setStatus(order.id, "preparing", owner)
            await setStatus(order.id, "ready", owner)
        }
        await courierApp()(`/api/courier/orders/${String(food.id)}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        await courierApp()(`/api/courier/orders/${String(food.id)}`, {
            method: "PATCH",
            json: { status: "delivered" },
        })

        const home = await json<Home>(await courierApp()("/api/courier/home"))
        expect(home.orders.map((o) => o.shopName).sort()).toEqual(["Osh Markaz", "Toza Suv"])
        expect(home.shops.map((s) => s.shopName)).toEqual(["Osh Markaz", "Toza Suv"])
        // Each owner sees only their own link and their own money.
        const waterCouriers = await json<{ id: string }[]>(await waterOwner("/api/owner/couriers"))
        expect(waterCouriers.map((c) => c.id)).toEqual([inWater])
        const waterMoney = await json<{ totals: { delivered: number } }>(
            await waterOwner("/api/owner/money"),
        )
        expect(waterMoney.totals.delivered).toBe(0)
        // The food owner cannot touch the water link.
        const foreign = await as(OWNER)(`/api/owner/couriers/${inWater}`, {
            method: "PATCH",
            json: { offToday: true },
        })
        expect(foreign.status).toBe(404)
    })

    it("reassigning tells the previous courier, even before their card was stored", async () => {
        const first = await hireCourier(client, { slug }, COURIER)
        const second = { id: 5006, first_name: "Bobur", language_code: "ru" }
        const bobur = await hireCourier(client, { slug }, second)
        const order = await placeOrder([{ productId: await osh(), quantity: 2 }])
        await setStatus(order.id, "accepted")
        await assign(order.id, first)
        // As if the first card's id had not been saved yet.
        await env.DB.prepare("UPDATE orders SET courier_message_id = NULL").run()
        await assign(order.id, bobur)
        expect(
            client.telegram.sent.some((m) => m.chatId === COURIER.id && m.html.includes("#1")),
        ).toBe(true)
        const toBobur = client.telegram.sent.find(
            (m) => m.chatId === second.id && m.html.includes("#1"),
        )
        // Bobur's Telegram is in Russian; the product speaks Uzbek only.
        expect(toBobur?.html).toContain("Yetkazib berish")
        const removed = client.telegram.sent.filter((m) => m.chatId === COURIER.id).at(-1)
        expect(removed?.token).toBe(env.COURIER_BOT_TOKEN)
        expect(removed?.html).toContain("#1")
        expect(removed?.html).not.toContain("Navoiy")
    })

    it("the owner removes a courier; the courier hears it", async () => {
        const courierId = await hireCourier(client, { slug }, COURIER)
        const removed = await as(OWNER)(`/api/owner/couriers/${courierId}`, { method: "DELETE" })
        expect(removed.status).toBe(204)
        expect(await json<unknown[]>(await as(OWNER)("/api/owner/couriers"))).toHaveLength(0)
        expect(client.telegram.sent.at(-1)).toMatchObject({
            chatId: COURIER.id,
            token: env.COURIER_BOT_TOKEN,
        })
        expect((await courierApp()("/api/courier/home")).status).toBe(403)
    })

    it("migration 0003 gives today's couriers a profile and keeps who was removed", async () => {
        const shop = await env.DB.prepare("SELECT id FROM businesses").first<{ id: string }>()
        // Rows as the previous Worker wrote them: no profile yet.
        await env.DB.batch([
            env.DB.prepare(
                `INSERT INTO couriers (id, business_id, telegram_id, name, phone, is_active,
                    created_at, updated_at) VALUES ('old-1', ?, 7007, 'Old Jasur', NULL, 1, 1, 1)`,
            ).bind(shop?.id),
            env.DB.prepare(
                `INSERT INTO couriers (id, business_id, telegram_id, name, phone, is_active,
                    created_at, updated_at) VALUES ('old-2', ?, 7008, 'Gone', '+998901110000', 0, 1, 2)`,
            ).bind(shop?.id),
        ])
        const migration = env.TEST_MIGRATIONS.find((m) => m.name.startsWith("0003"))
        // Statements carry their comments; run the data steps only (the tables already exist).
        const backfill = (migration?.queries ?? []).filter((q) =>
            /^\s*(INSERT|UPDATE)/i.test(q.replace(/^(\s*--[^\n]*\n)*/, "")),
        )
        expect(backfill.length).toBeGreaterThanOrEqual(3)
        await env.DB.batch(backfill.map((q) => env.DB.prepare(q)))

        const couriers = await json<{ name: string; status: string }[]>(
            await as(OWNER)("/api/owner/couriers"),
        )
        expect(couriers).toMatchObject([{ name: "Old Jasur", status: "active" }])
        const gone = await env.DB.prepare(
            "SELECT c.status, p.phone FROM couriers c JOIN courier_profiles p USING (telegram_id) WHERE c.id = 'old-2'",
        ).first<{ status: string; phone: string }>()
        expect(gone).toEqual({ status: "removed", phone: "+998901110000" })
    })

    it("grocery: weight items in grams, stop-list for today", async () => {
        const tomato = await addProduct({
            name: "Pomidor",
            price: 12_000,
            unit: "kg",
            category: "produce",
            step: 500,
        })
        const order = await placeOrder([{ productId: tomato, quantity: 1500 }])
        expect(order).toMatchObject({ subtotal: 18_000 })
        const bad = await as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId: tomato, quantity: 700 }], address: "Navoiy 12" },
        })
        expect(bad.status).toBe(400)

        await as(OWNER)(`/api/owner/products/${tomato}`, {
            method: "PATCH",
            json: { stopForToday: true },
        })
        const catalog = await json<{ data: unknown[] }>(await as(CUSTOMER)("/api/shop/products"))
        expect(catalog.data).toHaveLength(0)
        const owner = await json<{ data: { unavailableUntil?: string }[] }>(
            await as(OWNER)("/api/owner/products"),
        )
        expect(owner.data[0]?.unavailableUntil).toBeDefined()
    })

    it("water: returned bottles lower the deposit; the owner card shows them", async () => {
        await as(OWNER)("/api/owner/shop", {
            method: "PATCH",
            json: { features: ["reorder", "bottleDeposit"], bottleDeposit: 30_000 },
        })
        const water = await addProduct({
            name: "Suv 19 l",
            price: 15_000,
            unit: "bottle_19l",
            category: "water",
            returnable: true,
        })
        const order = await placeOrder([{ productId: water, quantity: 2 }], { bottlesReturned: 1 })
        expect(order).toMatchObject({ depositTotal: 30_000, bottlesReturned: 1, total: 70_000 })
        const card = client.telegram.sent.find(
            (m) => m.chatId === OWNER.id && m.html.includes("#1"),
        )
        expect(card?.html).toContain("30 000")
    })

    it("bot words follow the business type", async () => {
        const osh = await addProduct({
            name: "Osh",
            price: 35_000,
            unit: "portion",
            category: "meals",
        })
        const order = await placeOrder([{ productId: osh, quantity: 2 }])
        await setStatus(order.id, "accepted")
        await setStatus(order.id, "preparing")
        expect(client.telegram.sent.at(-1)?.html).toContain("👨‍🍳")

        await env.DB.prepare("UPDATE businesses SET type = 'grocery'").run()
        const second = await placeOrder([{ productId: osh, quantity: 2 }])
        await setStatus(second.id, "accepted")
        await setStatus(second.id, "preparing")
        expect(client.telegram.sent.at(-1)?.html).toContain("yig'ilmoqda")
    })
})
