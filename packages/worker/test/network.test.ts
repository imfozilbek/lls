import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    ADMIN,
    CUSTOMER,
    OTHER_BOT_TOKEN,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    hireCourier,
    sharePhoneWithShops,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const OTHER_OWNER = { id: 1002, first_name: "Dilshod", language_code: "ru" }
const OTHER_BOT = { id: 888000, username: "toza_suv_bot", firstName: "Toza" }
const BOBUR = { id: 7007, first_name: "Bobur", language_code: "ru" }
const OTABEK = { id: 7008, first_name: "Otabek", language_code: "ru" }
const GULISTAN = { latitude: 40.4897, longitude: 68.7842 }
const YANGIYER = { latitude: 40.275, longitude: 68.8225 }
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const UZ_OFFSET = 5 * HOUR
const DAY = 24 * HOUR

/**
 * The test clock: real time (initData is signed now), moved out of the last half hour before
 * Tashkent midnight, so a 10-minute wait never ends a shift.
 */
function startOfTest(): number {
    const real = Date.now()
    const local = (real + UZ_OFFSET) % DAY
    return local > DAY - HOUR / 2 ? real + HOUR : real
}

interface Order {
    id: string
    number: number
    status: string
    waitingForNetwork: boolean
    viaNetwork: boolean
    courierName?: string
    total: number
    error?: { code: string }
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("district network", () => {
    let client: TestClient
    let now: number
    let food: string
    let water: string
    let product: string

    const foodOwner = (): ReturnType<TestClient["as"]> =>
        client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: food })
    const waterOwner = (): ReturnType<TestClient["as"]> =>
        client.as(OTHER_OWNER, { botToken: OTHER_BOT_TOKEN, shop: water })
    const courierApp = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { courierBot: true })

    async function platform(text: string, from = ADMIN): Promise<void> {
        await client.request("/tg/platform", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-Bot-Api-Secret-Token": env.PLATFORM_WEBHOOK_SECRET,
            },
            body: JSON.stringify({
                update_id: 1,
                message: { message_id: 1, from, chat: { id: from.id }, text },
            }),
        })
    }

    async function placeAndAccept(): Promise<Order> {
        const customer = client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: food })
        await customer("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
        const placed = await json<Order>(
            await customer("/api/orders", {
                method: "POST",
                json: {
                    items: [{ productId: product, quantity: 2 }],
                    address: "Navoiy 12",
                    location: { latitude: 40.5, longitude: 68.79 },
                },
            }),
        )
        const accepted = await foodOwner()(`/api/owner/orders/${placed.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        expect(accepted.status).toBe(200)
        return json<Order>(accepted)
    }

    function offersTo(chatId: number): { html: string; data?: string }[] {
        return client.telegram.sent
            .filter((m) => m.chatId === chatId && m.token === env.COURIER_BOT_TOKEN)
            .map((m) => ({
                html: m.html,
                data: m.options?.keyboard?.inline_keyboard[0]?.[0]?.callback_data,
            }))
            .filter((m) => m.data?.startsWith("n:"))
    }

    beforeEach(async () => {
        now = startOfTest()
        client = testClient({
            bots: { [SHOP_BOT_TOKEN]: SHOP_BOT, [OTHER_BOT_TOKEN]: OTHER_BOT },
            clock: { now: () => new Date(now) },
        })
        food = (await createActiveShop(client)).slug
        water = (
            await createActiveShop(client, {
                botToken: OTHER_BOT_TOKEN,
                name: "Toza Suv",
                owner: OTHER_OWNER,
            })
        ).slug
        await foodOwner()("/api/owner/shop", { method: "PATCH", json: { location: GULISTAN } })
        await waterOwner()("/api/owner/shop", { method: "PATCH", json: { location: YANGIYER } })
        await platform("/district Guliston 40.4897,68.7842 30")
        const created = await foodOwner()("/api/owner/products", {
            method: "POST",
            json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
        })
        product = (await json<{ id: string }>(created)).id
        // Two couriers of the water shop; one joins from the bot's offer, one in the app.
        await hireCourier(
            client,
            { slug: water, botToken: OTHER_BOT_TOKEN, owner: OTHER_OWNER },
            BOBUR,
        )
        await client.courierBot({
            callback_query: {
                id: "cb-join",
                from: BOBUR,
                data: "net:join",
                message: { message_id: 5, chat: { id: BOBUR.id } },
            },
        })
        await hireCourier(
            client,
            { slug: water, botToken: OTHER_BOT_TOKEN, owner: OTHER_OWNER },
            OTABEK,
        )
        await courierApp(OTABEK)("/api/courier/network", {
            method: "PUT",
            json: { inNetwork: true },
        })
    })

    it("the admin sets the district; shops inside learn it", async () => {
        const saved = client.telegram.sent.find(
            (m) => m.chatId === ADMIN.id && m.html.includes("Guliston"),
        )
        expect(saved?.html).toContain("Guliston")
        expect(saved?.html).toMatch(/2\.?$/)
        const shop = await json<{ inDistrict: boolean; networkDelivery: boolean }>(
            await foodOwner()("/api/owner/shop"),
        )
        expect(shop).toMatchObject({ inDistrict: true, networkDelivery: true })
        // Only admins: others get silence, a wrong command gets the format.
        const before = client.telegram.sent.length
        await platform("/district Guliston wait 15", OWNER)
        expect(client.telegram.sent.length).toBe(before)
        await platform("/district nonsense")
        expect(client.telegram.sent.at(-1)?.html).toContain("/district")
        await platform("/district Guliston wait 15")
        expect(client.telegram.sent.at(-1)?.html).toContain("15")
    })

    it("accepted without a free courier: offers without the customer, the first «Беру» wins", async () => {
        const order = await placeAndAccept()
        expect(order.waitingForNetwork).toBe(true)
        expect(
            client.telegram.sent.some(
                (m) =>
                    (m.chatId === OWNER.id && m.html.includes("сети района")) ||
                    m.html.includes("tarmog"),
            ),
        ).toBe(true)

        for (const person of [BOBUR, OTABEK]) {
            const [offer] = offersTo(person.id)
            expect(offer?.data).toBe(`n:${order.id}`)
            expect(offer?.html).toContain("Osh Markaz")
            expect(offer?.html).not.toContain("Navoiy")
            expect(offer?.html).not.toContain("Aziz")
        }
        const listed = await json<{ data: { id: string; total: number }[] }>(
            await courierApp(BOBUR)("/api/courier/network/orders"),
        )
        expect(listed.data).toEqual([expect.objectContaining({ id: order.id, total: order.total })])

        // Both press at the same moment.
        const [first, second] = await Promise.all(
            [BOBUR, OTABEK].map((person) =>
                courierApp(person)(`/api/courier/network/orders/${order.id}/claim`, {
                    method: "POST",
                }),
            ),
        )
        const statuses = [first?.status, second?.status].sort()
        expect(statuses).toEqual([200, 422])
        const loser = first?.status === 422 ? first : second
        expect((await json<Order>(loser as Response)).error?.code).toBe("NETWORK_ORDER_TAKEN")
        const winner = first?.status === 200 ? BOBUR : OTABEK
        const other = winner === BOBUR ? OTABEK : BOBUR

        const edits = client.telegram.edited.filter((m) => m.token === env.COURIER_BOT_TOKEN)
        expect(edits.filter((m) => m.chatId === winner.id).at(-1)?.html).toContain("ваш")
        expect(edits.filter((m) => m.chatId === other.id).at(-1)?.html).toContain("уже взял")
        const card = client.telegram.sent.filter((m) => m.chatId === winner.id).at(-1)
        expect(card?.html).toContain("Navoiy 12")
        expect(
            client.telegram.sent.some(
                (m) => m.chatId === OWNER.id && m.html.includes(winner.first_name),
            ),
        ).toBe(true)

        // Delivers it; the money is already the food shop's: paid before cooking. (A week:
        // near Tashkent midnight the test clock is an hour ahead of the delivery time.)
        for (const status of ["preparing", "ready"]) {
            await foodOwner()(`/api/owner/orders/${order.id}`, {
                method: "PATCH",
                json: { status },
            })
        }
        const courier = courierApp(winner)
        // While it is on the road, the courier's screen lists that shop as a network one.
        const home = await json<{ shops: { shopName: string; status: string }[] }>(
            await courier("/api/courier/home"),
        )
        expect(home.shops).toContainEqual(
            expect.objectContaining({ shopName: "Osh Markaz", status: "network" }),
        )
        await courier(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "picked_up" },
        })
        const delivered = await courier(`/api/courier/orders/${order.id}`, {
            method: "PATCH",
            json: { status: "delivered" },
        })
        expect(await json<Order>(delivered)).toMatchObject({
            status: "delivered",
            viaNetwork: true,
        })
        const money = await json<{ totals: { delivered: number; paid: number } }>(
            await foodOwner()("/api/owner/money?period=week"),
        )
        expect(money.totals).toMatchObject({ delivered: 1, paid: order.total })
        // The food shop's courier list stays its own.
        expect(await json<unknown[]>(await foodOwner()("/api/owner/couriers"))).toEqual([])
    })

    it("«Беру» from the chat; a late press hears it is taken", async () => {
        const order = await placeAndAccept()
        await client.courierBot({
            callback_query: { id: "cb-1", from: OTABEK, data: `n:${order.id}` },
        })
        expect(client.telegram.answered).toContain("cb-1")
        await client.courierBot({
            callback_query: { id: "cb-2", from: BOBUR, data: `n:${order.id}` },
        })
        const stored = await env.DB.prepare("SELECT courier_name FROM orders WHERE id = ?")
            .bind(order.id)
            .first<{ courier_name: string }>()
        expect(stored?.courier_name).toBe("Otabek")
    })

    it("network off: the order stays with the shop; by hand it still goes", async () => {
        await foodOwner()("/api/owner/shop", { method: "PATCH", json: { networkDelivery: false } })
        const order = await placeAndAccept()
        expect(order.waitingForNetwork).toBe(false)
        expect(offersTo(BOBUR.id)).toEqual([])
        const handed = await foodOwner()(`/api/owner/orders/${order.id}/network`, { method: "PUT" })
        expect(await json<Order>(handed)).toMatchObject({ waitingForNetwork: true })
        expect(offersTo(BOBUR.id)).toHaveLength(1)
        // The shop's own courier takes it back: the offers close.
        const own = await hireCourier(client, { slug: food }, { id: 5005, first_name: "Jasur" })
        await foodOwner()(`/api/owner/orders/${order.id}/courier`, {
            method: "PUT",
            json: { courierId: own },
        })
        expect(client.telegram.edited.filter((m) => m.chatId === BOBUR.id).at(-1)?.html).toContain(
            "уже взял",
        )
        expect(
            (
                await json<{ data: unknown[] }>(
                    await courierApp(BOBUR)("/api/courier/network/orders"),
                )
            ).data,
        ).toEqual([])
    })

    it("nobody took it in 10 minutes: the shop and the admins hear it once", async () => {
        await courierApp(BOBUR)("/api/courier/network", {
            method: "PUT",
            json: { inNetwork: false },
        })
        await courierApp(OTABEK)("/api/courier/shift", { method: "PUT", json: { onShift: false } })
        const order = await placeAndAccept()
        expect(offersTo(BOBUR.id)).toEqual([])
        now += 10 * MINUTE
        await platform("/network")
        const report = client.telegram.sent.filter((m) => m.chatId === ADMIN.id)
        expect(report.some((m) => m.html.includes("Guliston"))).toBe(true)
        expect(report.some((m) => m.html.includes(`#${order.number}`))).toBe(true)
        expect(
            client.telegram.sent.some(
                (m) =>
                    m.chatId === OWNER.id &&
                    m.html.includes(`#${order.number}`) &&
                    m.html.includes("10"),
            ),
        ).toBe(true)
        const count = client.telegram.sent.length
        await platform("/network")
        expect(client.telegram.sent.length).toBe(count + 1)
        // Back on shift: the waiting order reaches the chat.
        await courierApp(OTABEK)("/api/courier/shift", { method: "PUT", json: { onShift: true } })
        expect(offersTo(OTABEK.id).map((o) => o.data)).toContain(`n:${order.id}`)
    })

    it("the migration adds the network without touching old rows", async () => {
        const row = await env.DB.prepare(
            "SELECT network_delivery, district_id FROM businesses WHERE slug = ?",
        )
            .bind(water)
            .first<{ network_delivery: number; district_id: string | null }>()
        expect(row?.network_delivery).toBe(1)
        expect(row?.district_id).not.toBeNull()
        const profile = await env.DB.prepare(
            "SELECT in_network FROM courier_profiles WHERE telegram_id = ?",
        )
            .bind(BOBUR.id)
            .first<{ in_network: number }>()
        expect(profile?.in_network).toBe(1)
    })
})
