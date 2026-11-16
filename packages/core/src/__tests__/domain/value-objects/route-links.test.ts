import { describe, expect, it } from "vitest"

import {
    NavApp,
    googleMapsUrl,
    routeUrl,
    twoGisUrl,
    yandexGoUrl,
    yandexMapsUrl,
    yandexNavigatorUrl,
} from "../../../domain/value-objects/route-links.js"

// Yakkabog': a shop and two doors.
const SHOP = { latitude: 38.9785, longitude: 66.6831 }
const DOOR = { latitude: 38.9712, longitude: 66.6904 }
const NEXT = { latitude: 38.9655, longitude: 66.7011 }

describe("the route in the courier's own app", () => {
    it("Yandex Navigator: its own scheme, every stop on the way", () => {
        expect(yandexNavigatorUrl([DOOR])).toBe(
            "yandexnavi://build_route_on_map?lat_to=38.971200&lon_to=66.690400",
        )
        expect(yandexNavigatorUrl([SHOP, DOOR, NEXT])).toBe(
            "yandexnavi://build_route_on_map?lat_via_0=38.978500&lon_via_0=66.683100" +
                "&lat_via_1=38.971200&lon_via_1=66.690400&lat_to=38.965500&lon_to=66.701100",
        )
    })

    it("Yandex Go: one point, the app's own link", () => {
        expect(yandexGoUrl([DOOR])).toBe(
            "https://3.redirect.appmetrica.yandex.com/route?end-lat=38.971200&end-lon=66.690400" +
                "&ref=zumda.shop&appmetrica_tracking_id=1178268795219780156&lang=uz",
        )
        expect(yandexGoUrl([SHOP, DOOR])).toBeNull()
    })

    it("Google Maps: the destination and the stops on the way, up to ten", () => {
        expect(googleMapsUrl([DOOR])).toBe(
            "https://www.google.com/maps/dir/?api=1&destination=38.971200%2C66.690400&travelmode=driving",
        )
        expect(googleMapsUrl([SHOP, DOOR, NEXT])).toBe(
            "https://www.google.com/maps/dir/?api=1&destination=38.965500%2C66.701100" +
                "&travelmode=driving&waypoints=38.978500%2C66.683100%7C38.971200%2C66.690400",
        )
        expect(googleMapsUrl(Array.from({ length: 11 }, () => DOOR))).toBeNull()
    })

    it("2GIS: one point, longitude first", () => {
        expect(twoGisUrl([DOOR])).toBe(
            "https://2gis.uz/routeSearch/rsType/car/to/66.690400,38.971200",
        )
        expect(twoGisUrl([SHOP, DOOR])).toBeNull()
    })

    it("Yandex Maps: from where the phone is, through every stop", () => {
        expect(yandexMapsUrl([SHOP, DOOR])).toBe(
            "https://yandex.uz/maps/?rtext=~38.978500,66.683100~38.971200,66.690400&rtt=auto",
        )
    })

    it("no stop, no route; one name for each app", () => {
        for (const app of Object.values(NavApp)) {
            expect(routeUrl(app, [])).toBeNull()
            expect(routeUrl(app, [DOOR])).toMatch(/^(https:\/\/|yandexnavi:\/\/)/)
        }
    })
})
