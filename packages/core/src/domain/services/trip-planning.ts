/**
 * Trips of one shop (owner's decision, October 2026): several orders going one way go with one
 * courier. Pure geometry: the owner's app suggests with it, the server checks with it.
 */
export interface GeoPoint {
    latitude: number
    longitude: number
}

/** Orders within this angle of each other, seen from the shop, go one way. */
export const SAME_DIRECTION_DEGREES = 35
/** A trip has at least two stops and at most this many. */
export const MIN_TRIP_STOPS = 2
export const MAX_TRIP_STOPS = 10

const EARTH_RADIUS_METERS = 6_371_000
const FULL_CIRCLE = 360
const HALF_CIRCLE = 180

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / HALF_CIRCLE
}

/** Great-circle distance in meters. */
export function metersBetween(a: GeoPoint, b: GeoPoint): number {
    const dLat = toRadians(b.latitude - a.latitude)
    const dLng = toRadians(b.longitude - a.longitude)
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

/** Compass bearing from `from` to `to`, degrees 0..360 (0 = north, 90 = east). */
export function bearing(from: GeoPoint, to: GeoPoint): number {
    const lat1 = toRadians(from.latitude)
    const lat2 = toRadians(to.latitude)
    const dLng = toRadians(to.longitude - from.longitude)
    const y = Math.sin(dLng) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
    const degrees = (Math.atan2(y, x) * HALF_CIRCLE) / Math.PI
    return (degrees + FULL_CIRCLE) % FULL_CIRCLE
}

/** The smaller angle between two bearings, 0..180. */
export function bearingGap(a: number, b: number): number {
    const gap = Math.abs(a - b) % FULL_CIRCLE
    return gap > HALF_CIRCLE ? FULL_CIRCLE - gap : gap
}

/** Seen from the shop, `b` lies the same way as `a` (within ±35°). */
export function sameDirection(shop: GeoPoint, a: GeoPoint, b: GeoPoint): boolean {
    return bearingGap(bearing(shop, a), bearing(shop, b)) <= SAME_DIRECTION_DEGREES
}

/**
 * Zumda's order of stops: from the shop to the nearest one, then always to the nearest next.
 * Returns the indexes of `stops` in that order. The owner may change it.
 */
export function nearestNextOrder(shop: GeoPoint, stops: readonly GeoPoint[]): number[] {
    const left = stops.map((_, i) => i)
    const order: number[] = []
    let here = shop
    while (left.length > 0) {
        let best = 0
        for (let i = 1; i < left.length; i++) {
            const candidate = stops[left[i] ?? 0]
            const current = stops[left[best] ?? 0]
            if (
                candidate &&
                current &&
                metersBetween(here, candidate) < metersBetween(here, current)
            ) {
                best = i
            }
        }
        const [next] = left.splice(best, 1)
        if (next === undefined) {
            break
        }
        order.push(next)
        here = stops[next] ?? here
    }
    return order
}
