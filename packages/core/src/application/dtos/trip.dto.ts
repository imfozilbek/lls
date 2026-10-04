import type { LocationDTO } from "./shop.dto.js"
import type { Trip } from "../../domain/entities/trip.js"

/**
 * A trip: the order of its stops and the way between them. The orders themselves come as they
 * always do (`OrderDTO.tripId`, `tripStop`): the app joins them by id.
 */
export interface TripDTO {
    id: string
    businessId: string
    courierId: string
    /** Order ids, stop 1 first. */
    stops: string[]
    /** Along the roads; absent when the road service was not available (draw straight lines). */
    route?: {
        line: LocationDTO[]
        distanceMeters: number
        durationSeconds: number
    }
    createdAt: string
}

export function toTripDTO(trip: Trip): TripDTO {
    const route = trip.route
    return {
        id: trip.id,
        businessId: trip.businessId,
        courierId: trip.courierId,
        stops: [...trip.stops],
        route: route && {
            line: route.line.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
        },
        createdAt: trip.createdAt.toISOString(),
    }
}
