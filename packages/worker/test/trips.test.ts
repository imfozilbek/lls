import { env } from "cloudflare:workers"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OrsRoutePlanner } from "../src/routing.js"

import {
    CUSTOMER,
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
const SHOP = { latitude: 38.9785, longitude: 66.6831 }
const north = (km: number) => ({ latitude: SHOP.latitude + km / 111.32, longitude: SHOP.longitude })

interface Order {
    id: string
    number: number
    status: string
    tripId?: string
    tripStop?: number
    courierId?: string
}
interface Trip {
    id: string
    stops: string[]
    route?: { line: { latitude: number; longitude: number }[]; distanceMeters: number }
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("trips: several orders one way, one courier", () => {
    let client: TestClient
    let slug: string
    let courierId: string
    let productId: string

    const as = (user: object): ReturnType<TestClient["as"]> =>
        client.as(user, { botToken: SHOP_BOT_TOKEN, shop: slug })
    const courier = (path: string, init?: RequestInit & { json?: unknown }): Promise<Response> =>
        client.as(COURIER, { courierBot: true })(path, init)

    /** A paid, accepted order with the customer's pin `km` north of the shop. */
    async function accepted(km: number): Promise<Order> {
        const placed = await as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: {
                items: [{ productId, quantity: 2 }],
                address: "Navoiy 12",
                location: north(km),
            },
        })
        expect(placed.status).toBe(201)
        const order = await json<Order>(placed)
        const paid = await as(OWNER)(`/api/owner/orders/${order.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        expect(paid.status).toBe(200)
        return order
    }

    const setStatus = (id: string, status: string): Promise<Response> =>
        as(OWNER)(`/api/owner/orders/${id}`, { method: "PATCH", json: { status } })

    const createTrip = (orderIds: string[]): Promise<Response> =>
        as(OWNER)("/api/owner/trips", { method: "POST", json: { courierId, orderIds } })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
        await as(OWNER)("/api/owner/shop", { method: "PATCH", json: { location: SHOP } })
        const product = await as(OWNER)("/api/owner/products", {
            method: "POST",
            json: { name: "Osh", price: 35_000, unit: "portion", category: "meals" },
        })
        productId = (await json<{ id: string }>(product)).id
        courierId = await hireCourier(client, { slug }, COURIER)
        await courier("/api/courier/shift", { method: "PUT", json: { onShift: true } })
        await as(CUSTOMER)("/api/me")
        await sharePhoneWithShops(CUSTOMER.id)
    })

    it("the owner makes a trip: stops in order, one courier, one message with the order", async () => {
        const [a, b, c] = [await accepted(1), await accepted(2), await accepted(3)]
        const created = await createTrip([a.id, b.id, c.id])
        expect(created.status).toBe(201)
        const { trip, orders } = await json<{ trip: Trip; orders: Order[] }>(created)
        expect(trip.stops).toEqual([a.id, b.id, c.id])
        // No road service set up here: the app draws straight lines.
        expect(trip.route).toBeUndefined()
        expect(orders.map((o) => [o.tripStop, o.courierId])).toEqual([
            [1, courierId],
            [2, courierId],
            [3, courierId],
        ])

        const toCourier = client.telegram.sent.filter((m) => m.chatId === COURIER.id)
        const summary = toCourier.find((m) => m.html.includes("bir yo'nalishda"))
        expect(summary?.html).toContain(`#${a.number} → #${b.number} → #${c.number}`)
        expect(summary?.token).toBe(env.COURIER_BOT_TOKEN)

        const listed = await json<{ data: Trip[] }>(await as(OWNER)("/api/owner/trips"))
        expect(listed.data.map((t) => t.id)).toEqual([trip.id])
        const home = await json<{ trips: Trip[] }>(await courier("/api/courier/home"))
        expect(home.trips.map((t) => t.stops)).toEqual([[a.id, b.id, c.id]])

        const moved = await as(OWNER)(`/api/owner/trips/${trip.id}`, {
            method: "PATCH",
            json: { orderIds: [c.id, a.id, b.id] },
        })
        expect((await json<{ trip: Trip }>(moved)).trip.stops).toEqual([c.id, a.id, b.id])
    })

    it("«Hammasini oldim» once all are ready; a cancelled stop leaves the trip", async () => {
        const [a, b, c] = [await accepted(1), await accepted(2), await accepted(3)]
        const { trip } = await json<{ trip: Trip }>(await createTrip([a.id, b.id, c.id]))
        const pickUp = (): Promise<Response> =>
            courier(`/api/courier/trips/${trip.id}/pickup`, { method: "POST" })

        await setStatus(b.id, "cancelled")
        for (const id of [a.id, c.id]) {
            await setStatus(id, "preparing")
        }
        await setStatus(a.id, "ready")
        const early = await pickUp()
        expect(early.status).toBe(422)
        expect(await json(early)).toMatchObject({ error: { code: "TRIP_NOT_READY" } })
        await setStatus(c.id, "ready")

        const stranger = await client.as(STRANGER, { courierBot: true })(
            `/api/courier/trips/${trip.id}/pickup`,
            { method: "POST" },
        )
        expect([403, 404]).toContain(stranger.status)

        const picked = await json<{ trip: Trip; orders: Order[] }>(await pickUp())
        expect(picked.trip.stops).toEqual([a.id, c.id])
        expect(picked.orders.map((o) => o.status)).toEqual(["picked_up", "picked_up"])
    })

    it("refuses one order, an order without a pin and another shop's courier", async () => {
        const a = await accepted(1)
        const one = await createTrip([a.id])
        expect(one.status).toBe(422)
        expect(await json(one)).toMatchObject({ error: { code: "TRIP_STOPS" } })

        const placed = await as(CUSTOMER)("/api/orders", {
            method: "POST",
            json: { items: [{ productId, quantity: 2 }], address: "Navoiy 12" },
        })
        const noPin = await json<Order>(placed)
        await as(OWNER)(`/api/owner/orders/${noPin.id}/payment`, {
            method: "PATCH",
            json: { action: "paid" },
        })
        const refused = await createTrip([a.id, noPin.id])
        expect(await json(refused)).toMatchObject({ error: { code: "NOT_FOR_TRIP" } })
        expect((await as(STRANGER)("/api/owner/trips")).status).toBe(403)
        expect((await createTrip([])).status).toBe(400)
    })
})

describe("OpenRouteService", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("no key: no call, null", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        expect(await new OrsRoutePlanner(undefined).route([SHOP, north(1)])).toBeNull()
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("asks driving-car with [lng, lat] and reads the way, the meters and the seconds", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            Response.json({
                features: [
                    {
                        geometry: {
                            coordinates: [
                                [66.6831, 38.9785],
                                [66.6832, 38.99],
                            ],
                        },
                        properties: { summary: { distance: 1234.5, duration: 180.4 } },
                    },
                ],
            }),
        )
        const route = await new OrsRoutePlanner("key-1", "https://ors.test").route([SHOP, north(1)]) // secret-scan: fake
        expect(route).toEqual({
            line: [SHOP, { latitude: 38.99, longitude: 66.6832 }],
            distanceMeters: 1235,
            durationSeconds: 180,
        })
        const [url, init] = fetchSpy.mock.calls[0] ?? []
        expect(String(url)).toBe("https://ors.test/v2/directions/driving-car/geojson")
        expect(JSON.parse(String(init?.body))).toEqual({
            coordinates: [
                [SHOP.longitude, SHOP.latitude],
                [north(1).longitude, north(1).latitude],
            ],
        })
    })

    it("an error or a strange answer: null, the trip goes on with straight lines", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 403 }))
        expect(await new OrsRoutePlanner("k").route([SHOP, north(1)])).toBeNull()
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ features: [] }))
        expect(await new OrsRoutePlanner("k").route([SHOP, north(1)])).toBeNull()
        vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"))
        expect(await new OrsRoutePlanner("k").route([SHOP, north(1)])).toBeNull()
    })
})
