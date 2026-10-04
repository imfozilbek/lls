import { Trip } from "../../../domain/entities/trip.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { toTripDTO } from "../../dtos/trip.dto.js"
import { requireOwnedBusiness } from "../shared.js"

import type { Business } from "../../../domain/entities/business.js"
import type { Courier } from "../../../domain/entities/courier.js"
import type { Order } from "../../../domain/entities/order.js"
import type { GeoPoint } from "../../../domain/services/trip-planning.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { TripDTO } from "../../dtos/trip.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"
import type { RoutePlanner, TripRepository } from "../../ports/trip-repository.js"

export interface TripDeps {
    businesses: BusinessRepository
    couriers: CourierRepository
    orders: OrderRepository
    trips: TripRepository
    routes: RoutePlanner
    clock: Clock
    newId(): string
}

/** A trip with its orders: what the owner's and the courier's screens and messages need. */
export interface TripResult {
    trip: TripDTO
    orders: OrderDTO[]
    /** The courier, for the courier bot's message. */
    courierTelegramId: number
}

async function loadOrders(orders: OrderRepository, ids: readonly string[]): Promise<Order[]> {
    const found = await Promise.all(ids.map((id) => orders.findById(id)))
    return found.map((order, i) => {
        if (!order) {
            throw EntityNotFoundError.order(ids[i] ?? "")
        }
        return order
    })
}

/** The shop, then the stops in order: the points the road service gets. */
function routePoints(shop: Business, stops: readonly Order[]): GeoPoint[] {
    const points: GeoPoint[] = shop.location ? [shop.location] : []
    for (const order of stops) {
        if (order.location) {
            points.push(order.location)
        }
    }
    return points
}

async function planRoute(
    deps: TripDeps,
    trip: Trip,
    shop: Business,
    stops: readonly Order[],
): Promise<void> {
    const route = await deps.routes.route(routePoints(shop, stops))
    trip.setRoute(route ?? undefined, deps.clock.now())
}

async function requireTripOfShop(
    deps: TripDeps,
    input: { actorTelegramId: number; businessId: string; tripId: string },
): Promise<{ trip: Trip; shop: Business }> {
    const shop = await requireOwnedBusiness(
        deps.businesses,
        input.businessId,
        input.actorTelegramId,
    )
    const trip = await deps.trips.findById(input.tripId)
    if (!trip || trip.businessId !== input.businessId) {
        throw EntityNotFoundError.trip(input.tripId)
    }
    return { trip, shop }
}

async function requireCourierLink(
    deps: TripDeps,
    businessId: string,
    id: string,
): Promise<Courier> {
    const courier = await deps.couriers.findById(id)
    if (!courier || courier.businessId !== businessId) {
        throw EntityNotFoundError.courier(id)
    }
    return courier
}

/** An order of this shop, with the pin, not taken by the network, not in this courier's trip. */
function assertCanJoin(order: Order, businessId: string, courierId: string): void {
    if (order.businessId !== businessId) {
        throw EntityNotFoundError.order(order.id)
    }
    if (!order.location) {
        throw BusinessRuleViolationError.notForTrip(order.id, "no_location")
    }
    if (order.isViaNetwork()) {
        throw BusinessRuleViolationError.notForTrip(order.id, "no_own_courier")
    }
    if (order.tripId !== undefined && order.courierId === courierId) {
        throw BusinessRuleViolationError.notForTrip(order.id, "in_trip")
    }
}

function result(trip: Trip, orders: readonly Order[], courier: Courier): TripResult {
    return {
        trip: toTripDTO(trip),
        orders: orders.map(toOrderDTO),
        courierTelegramId: courier.telegramId.value,
    }
}

export class CreateTripUseCase {
    constructor(private readonly deps: TripDeps) {}

    /**
     * «Tayinlash» in «Bir yo'nalish»: these orders, in this order, go with one courier of the
     * shop. Each order is checked as for a single assignment, and each must have the pin.
     */
    async execute(input: {
        actorTelegramId: number
        businessId: string
        courierId: string
        orderIds: string[]
    }): Promise<TripResult> {
        const { deps } = this
        const shop = await requireOwnedBusiness(
            deps.businesses,
            input.businessId,
            input.actorTelegramId,
        )
        const courier = await requireCourierLink(deps, input.businessId, input.courierId)
        const now = deps.clock.now()
        const trip = Trip.create({
            id: deps.newId(),
            businessId: input.businessId,
            courierId: courier.id,
            stops: input.orderIds,
            now,
        })
        const orders = await loadOrders(deps.orders, input.orderIds)
        // Every order is checked before any changes: one refused order leaves all as they were.
        for (const order of orders) {
            assertCanJoin(order, input.businessId, courier.id)
        }
        for (const [index, order] of orders.entries()) {
            order.assignCourier(courier, now)
            order.joinTrip(trip.id, index + 1)
        }
        await planRoute(deps, trip, shop, orders)
        await deps.trips.insert(trip)
        await Promise.all(orders.map((order) => deps.orders.save(order)))
        return result(trip, orders, courier)
    }
}

export class ReorderTripUseCase {
    constructor(private readonly deps: TripDeps) {}

    /** The owner moves stops still to go (↑↓); the way is planned again. */
    async execute(input: {
        actorTelegramId: number
        businessId: string
        tripId: string
        orderIds: string[]
    }): Promise<TripResult> {
        const { deps } = this
        const { trip, shop } = await requireTripOfShop(deps, input)
        const orders = await loadOrders(deps.orders, trip.stops)
        const done = orders.filter((o) => o.status === OrderStatus.DELIVERED).map((o) => o.id)
        trip.reorder(input.orderIds, done, deps.clock.now())
        const byId = new Map(orders.map((o) => [o.id, o]))
        const ordered = trip.stops.map((id) => byId.get(id)).filter((o): o is Order => !!o)
        for (const [index, order] of ordered.entries()) {
            order.setTripStop(index + 1)
        }
        await planRoute(deps, trip, shop, ordered)
        await deps.trips.save(trip)
        await Promise.all(ordered.map((order) => deps.orders.save(order)))
        const courier = await requireCourierLink(deps, input.businessId, trip.courierId)
        return result(trip, ordered, courier)
    }
}

export class PickUpTripUseCase {
    constructor(private readonly deps: TripDeps) {}

    /** «Hammasini oldim»: the courier took every order of the trip from the shop at once. */
    async execute(input: { telegramId: number; tripId: string }): Promise<TripResult> {
        const { deps } = this
        const trip = await deps.trips.findById(input.tripId)
        if (!trip) {
            throw EntityNotFoundError.trip(input.tripId)
        }
        const courier = await deps.couriers.findById(trip.courierId)
        if (!courier || courier.telegramId.value !== input.telegramId) {
            throw ForbiddenError.notCourier(trip.businessId)
        }
        const orders = await loadOrders(deps.orders, trip.stops)
        const waiting = orders.filter((o) => o.status !== OrderStatus.PICKED_UP && !o.isFinal())
        const ready = waiting.filter((o) => o.status === OrderStatus.READY)
        if (ready.length !== waiting.length || waiting.length === 0) {
            throw BusinessRuleViolationError.tripNotReady(ready.length, waiting.length)
        }
        const by = { role: "courier" as const, courierId: courier.id }
        for (const order of ready) {
            order.advanceTo(OrderStatus.PICKED_UP, by)
        }
        await Promise.all(ready.map((order) => deps.orders.save(order)))
        return result(trip, orders, courier)
    }
}

export class RefreshTripRouteUseCase {
    constructor(private readonly deps: TripDeps) {}

    /** After an order of the trip was cancelled: the way goes through the stops left. */
    async execute(input: { tripId: string }): Promise<void> {
        const { deps } = this
        const trip = await deps.trips.findById(input.tripId)
        if (!trip) {
            return
        }
        const shop = await deps.businesses.findById(trip.businessId)
        if (!shop) {
            return
        }
        const orders = await loadOrders(deps.orders, trip.stops)
        await planRoute(deps, trip, shop, orders)
        await deps.trips.save(trip)
    }
}

export class ListShopTripsUseCase {
    constructor(private readonly deps: TripDeps) {}

    /**
     * The shop's trips still on the way, each with its orders (delivered ones too): the owner
     * sees which stops are done and where the next one is.
     */
    async execute(input: {
        actorTelegramId: number
        businessId: string
    }): Promise<{ trip: TripDTO; orders: OrderDTO[] }[]> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        const trips = await this.deps.trips.listOpenByBusiness(input.businessId)
        return Promise.all(
            trips.map(async (trip) => ({
                trip: toTripDTO(trip),
                orders: (await loadOrders(this.deps.orders, trip.stops)).map(toOrderDTO),
            })),
        )
    }
}
