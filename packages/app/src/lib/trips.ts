import { OrderStatus, nearestNextOrder, sameDirection } from "@zumda/core"

import type { Point } from "./map.js"
import type { OrderDTO, TripDTO } from "@zumda/core"

/**
 * Trips in the app (owner's decision, October 2026): several orders one way with one courier.
 * The geometry is the core's; the server checks everything again when the trip is made.
 */
const JOINABLE: readonly string[] = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY]

/** Not yet picked up, with the customer's pin, not with the network, not already in a trip. */
export function canJoinTrip(order: OrderDTO): boolean {
    return (
        JOINABLE.includes(order.status) &&
        order.location !== undefined &&
        !order.viaNetwork &&
        order.tripId === undefined
    )
}

/** Other orders that go the same way from the shop (within ±35°). */
export function sameWayOrders(
    order: OrderDTO,
    orders: readonly OrderDTO[],
    shop: Point | undefined,
): OrderDTO[] {
    const here = order.location
    if (!shop || !here || !canJoinTrip(order)) {
        return []
    }
    return orders.filter(
        (other) =>
            other.id !== order.id &&
            canJoinTrip(other) &&
            other.location !== undefined &&
            sameDirection(shop, here, other.location),
    )
}

/** Zumda's order of the stops: from the shop to the nearest, then the nearest next. */
export function suggestedOrder(shop: Point, orders: readonly OrderDTO[]): OrderDTO[] {
    const points = orders.map((o) => o.location ?? shop)
    return nearestNextOrder(shop, points).flatMap((i) => (orders[i] ? [orders[i]] : []))
}

/** The trip's orders in the order of the stops (cancelled ones are no longer stops). */
export function tripOrders(trip: TripDTO, orders: readonly OrderDTO[]): OrderDTO[] {
    const byId = new Map(orders.map((o) => [o.id, o]))
    return trip.stops.flatMap((id) => {
        const order = byId.get(id)
        return order ? [order] : []
    })
}

/** The line to draw: the road from the server, or straight from the shop through the stops. */
export function tripLine(
    trip: TripDTO | null,
    shop: Point | undefined,
    stops: readonly OrderDTO[],
): Point[] {
    if (trip?.route) {
        return trip.route.line
    }
    const points = stops.flatMap((o) => (o.location ? [o.location] : []))
    return shop ? [shop, ...points] : points
}

/**
 * Yandex Navigator (or Yandex Maps) with every stop still to go, in order, from where the
 * courier is now: `rtext=~a~b~c` (an empty start is "my place"), by car.
 */
export function yandexRouteUrl(stops: readonly Point[]): string {
    const points = stops.map((p) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`)
    return `https://yandex.uz/maps/?rtext=~${points.join("~")}&rtt=auto`
}

/** Delivered or cancelled: the stop is behind. */
export function isStopDone(order: OrderDTO): boolean {
    return order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED
}
