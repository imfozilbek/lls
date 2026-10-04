import { describe, expect, it } from "vitest"

import { Trip } from "../../domain/entities/trip.js"
import {
    bearing,
    bearingGap,
    metersBetween,
    nearestNextOrder,
    sameDirection,
} from "../../domain/services/trip-planning.js"

const SHOP = { latitude: 38.9785, longitude: 66.6831 }
const north = (km: number) => ({ latitude: SHOP.latitude + km / 111.32, longitude: SHOP.longitude })
const east = (km: number) => ({
    latitude: SHOP.latitude,
    longitude: SHOP.longitude + km / (111.32 * Math.cos((SHOP.latitude * Math.PI) / 180)),
})

describe("trip planning: one way from the shop", () => {
    it("bearings: north is 0, east is 90; the gap wraps around north", () => {
        expect(bearing(SHOP, north(1))).toBeCloseTo(0, 0)
        expect(bearing(SHOP, east(1))).toBeCloseTo(90, 0)
        expect(bearingGap(350, 10)).toBe(20)
        expect(bearingGap(90, 270)).toBe(180)
        expect(metersBetween(SHOP, north(1))).toBeCloseTo(1000, -1)
    })

    it("the same way within ±35°, not across", () => {
        const northEast = { latitude: north(1).latitude, longitude: east(0.5).longitude }
        expect(sameDirection(SHOP, north(2), northEast)).toBe(true)
        expect(sameDirection(SHOP, north(2), east(2))).toBe(false)
    })

    it("Zumda's order: nearest first, then always the nearest next", () => {
        const stops = [north(3), north(1), north(2)]
        expect(nearestNextOrder(SHOP, stops)).toEqual([1, 2, 0])
        expect(nearestNextOrder(SHOP, [])).toEqual([])
    })
})

describe("Trip", () => {
    const now = new Date("2026-10-04T08:00:00Z")
    const trip = (): Trip =>
        Trip.create({
            id: "t-1",
            businessId: "biz-1",
            courierId: "c-1",
            stops: ["a", "b", "c"],
            now,
        })

    it("has 2..10 different stops", () => {
        expect(trip().stopOf("b")).toBe(2)
        expect(trip().stopOf("z")).toBeUndefined()
        const make = (stops: string[]) => () =>
            Trip.create({ id: "t", businessId: "b", courierId: "c", stops, now })
        expect(make(["a"])).toThrow(expect.objectContaining({ rule: "TRIP_STOPS" }))
        expect(make(["a", "a"])).toThrow(expect.objectContaining({ rule: "TRIP_STOPS" }))
        expect(make(Array.from({ length: 11 }, (_, i) => `o${i}`))).toThrow()
    })

    it("the owner reorders the stops still to go; done ones stay first", () => {
        const t = trip()
        t.reorder(["c", "b"], ["a"], now)
        expect(t.stops).toEqual(["a", "c", "b"])
        expect(() => t.reorder(["c"], ["a"], now)).toThrow()
        expect(() => t.reorder(["c", "z"], ["a"], now)).toThrow()
        t.setRoute({ line: [], distanceMeters: 5, durationSeconds: 6 }, now)
        expect(t.route?.distanceMeters).toBe(5)
    })
})
