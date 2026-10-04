import { describe, expect, it } from "vitest"

import { canJoinTrip, sameWayOrders, suggestedOrder, tripLine, yandexRouteUrl } from "./trips.js"

import type { OrderDTO, TripDTO } from "@zumda/core"

const SHOP = { latitude: 38.9785, longitude: 66.6831 }
const north = (km: number) => ({ latitude: SHOP.latitude + km / 111.32, longitude: SHOP.longitude })
const east = (km: number) => ({ latitude: SHOP.latitude, longitude: SHOP.longitude + km / 86.5 })

function order(
    id: string,
    location?: { latitude: number; longitude: number },
    extra = {},
): OrderDTO {
    return { id, status: "accepted", location, viaNetwork: false, ...extra } as unknown as OrderDTO
}

describe("trips in the app", () => {
    it("joins only orders before pickup, with the pin, not with the network, not in a trip", () => {
        expect(canJoinTrip(order("a", north(1)))).toBe(true)
        expect(canJoinTrip(order("a"))).toBe(false)
        expect(canJoinTrip(order("a", north(1), { status: "picked_up" }))).toBe(false)
        expect(canJoinTrip(order("a", north(1), { viaNetwork: true }))).toBe(false)
        expect(canJoinTrip(order("a", north(1), { tripId: "t" }))).toBe(false)
    })

    it("finds the orders the same way and puts them in Zumda's order", () => {
        const a = order("a", north(3))
        const b = order("b", north(1))
        const c = order("c", east(2))
        expect(sameWayOrders(a, [a, b, c], SHOP).map((o) => o.id)).toEqual(["b"])
        expect(sameWayOrders(a, [a, b], undefined)).toEqual([])
        expect(suggestedOrder(SHOP, [a, b]).map((o) => o.id)).toEqual(["b", "a"])
    })

    it("draws the road when known, else straight lines from the shop", () => {
        const stops = [order("a", north(1)), order("b", north(2))]
        expect(tripLine(null, SHOP, stops)).toEqual([SHOP, north(1), north(2)])
        const trip = { route: { line: [SHOP], distanceMeters: 1, durationSeconds: 1 } } as TripDTO
        expect(tripLine(trip, SHOP, stops)).toEqual([SHOP])
    })

    it("opens Yandex with the stops in order, from where the courier is", () => {
        expect(yandexRouteUrl([north(1), north(2)])).toBe(
            `https://yandex.uz/maps/?rtext=~${north(1).latitude.toFixed(6)},66.683100~${north(2).latitude.toFixed(6)},66.683100&rtt=auto`,
        )
    })
})
