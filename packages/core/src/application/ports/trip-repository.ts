import type { Trip, TripRoute } from "../../domain/entities/trip.js"
import type { GeoPoint } from "../../domain/services/trip-planning.js"

export interface TripRepository {
    insert(trip: Trip): Promise<void>
    /** The route and the time it changed (the stops live in the orders: `trip_stop`). */
    save(trip: Trip): Promise<void>
    /** With its stops in order (cancelled orders left out). */
    findById(id: string): Promise<Trip | null>
    /** Trips of the shop with at least one order still on the way. */
    listOpenByBusiness(businessId: string): Promise<Trip[]>
    /** Trips of these courier links with at least one order still on the way. */
    listOpenByCouriers(courierIds: readonly string[]): Promise<Trip[]>
}

/** The way along the roads through these points, in this order (OpenRouteService). */
export interface RoutePlanner {
    /** Null when the road service is not set up or did not answer: straight lines are drawn. */
    route(points: readonly GeoPoint[]): Promise<TripRoute | null>
}
