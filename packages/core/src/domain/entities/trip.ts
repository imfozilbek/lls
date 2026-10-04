import { BusinessRuleViolationError } from "../errors/business-rule.error.js"
import { MAX_TRIP_STOPS, MIN_TRIP_STOPS } from "../services/trip-planning.js"

import type { GeoPoint } from "../services/trip-planning.js"

/** The way along the roads (OpenRouteService), or straight lines when it was not available. */
export interface TripRoute {
    line: GeoPoint[]
    distanceMeters: number
    durationSeconds: number
}

export interface TripProps {
    id: string
    businessId: string
    /** The shop's courier link that carries every order of the trip. */
    courierId: string
    /** Order ids in the order of the stops. */
    stops: string[]
    route?: TripRoute
    createdAt: Date
    updatedAt: Date
}

/**
 * Several orders of one shop going one way, carried by one courier in a set order (owner's
 * decision, October 2026). The orders keep their own statuses; the trip is the order of stops
 * and the way between them. It is over when all its orders are.
 */
export class Trip {
    private constructor(private props: TripProps) {}

    static create(input: {
        id: string
        businessId: string
        courierId: string
        stops: readonly string[]
        now: Date
    }): Trip {
        assertStops(input.stops)
        return new Trip({
            id: input.id,
            businessId: input.businessId,
            courierId: input.courierId,
            stops: [...input.stops],
            createdAt: input.now,
            updatedAt: input.now,
        })
    }

    static reconstitute(props: TripProps): Trip {
        return new Trip({ ...props, stops: [...props.stops] })
    }

    get id(): string {
        return this.props.id
    }
    get businessId(): string {
        return this.props.businessId
    }
    get courierId(): string {
        return this.props.courierId
    }
    get stops(): readonly string[] {
        return this.props.stops
    }
    get route(): TripRoute | undefined {
        return this.props.route
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    /** The stop number (1…) of this order, or undefined when it is not in the trip. */
    stopOf(orderId: string): number | undefined {
        const index = this.props.stops.indexOf(orderId)
        return index < 0 ? undefined : index + 1
    }

    /**
     * The owner's new order of the stops still to go. Stops already done (`fixed`) stay first,
     * as they were; the rest must be exactly the same orders.
     */
    reorder(remaining: readonly string[], fixed: readonly string[], now: Date): void {
        const before = this.props.stops.filter((id) => !fixed.includes(id))
        const same =
            remaining.length === before.length &&
            new Set(remaining).size === remaining.length &&
            remaining.every((id) => before.includes(id))
        if (!same) {
            throw BusinessRuleViolationError.tripStops(MIN_TRIP_STOPS, MAX_TRIP_STOPS)
        }
        const done = this.props.stops.filter((id) => fixed.includes(id))
        this.props.stops = [...done, ...remaining]
        this.props.updatedAt = now
    }

    setRoute(route: TripRoute | undefined, now: Date): void {
        this.props.route = route
        this.props.updatedAt = now
    }
}

function assertStops(stops: readonly string[]): void {
    const unique = new Set(stops).size === stops.length
    if (!unique || stops.length < MIN_TRIP_STOPS || stops.length > MAX_TRIP_STOPS) {
        throw BusinessRuleViolationError.tripStops(MIN_TRIP_STOPS, MAX_TRIP_STOPS)
    }
}
