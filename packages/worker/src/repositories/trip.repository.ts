import { ACTIVE_ORDER_STATUSES, OrderStatus, Trip } from "@zumda/core"

import { placeholders } from "./rows.js"

import type { GeoPoint, TripRepository, TripRoute } from "@zumda/core"

interface TripRow {
    id: string
    business_id: string
    courier_id: string
    route: string | null
    distance_m: number | null
    duration_s: number | null
    created_at: number
    updated_at: number
}

interface StopRow {
    id: string
    trip_id: string
}

const COLUMNS = "id, business_id, courier_id, route, distance_m, duration_s, created_at, updated_at"
/** A screen never needs more open trips than this. */
const OPEN_LIMIT = 50

/** Five decimals: about a meter, and a short JSON. */
const PRECISION = 1e5

/**
 * Open trips are found from their active orders (an index range), never by reading every trip of
 * a shop or a courier ever made. Binds: the owners' ids, then the active statuses.
 */
function openTripsSql(where: string): string {
    return `SELECT ${COLUMNS} FROM trips
        WHERE id IN (
            SELECT trip_id FROM orders
            WHERE ${where} AND status IN (${placeholders(ACTIVE_ORDER_STATUSES.length)})
                AND trip_id IS NOT NULL
        )
        ORDER BY created_at DESC LIMIT ${OPEN_LIMIT}`
}

export const OPEN_TRIPS_OF_BUSINESS_SQL = openTripsSql("business_id = ?")

export function openTripsOfCouriersSql(count: number): string {
    return openTripsSql(`courier_id IN (${placeholders(count)})`)
}

function encodeLine(line: readonly GeoPoint[]): string {
    return JSON.stringify(
        line.map((p) => [
            Math.round(p.longitude * PRECISION) / PRECISION,
            Math.round(p.latitude * PRECISION) / PRECISION,
        ]),
    )
}

function decodeLine(text: string): GeoPoint[] {
    const raw = JSON.parse(text) as [number, number][]
    return raw.map(([longitude, latitude]) => ({ latitude, longitude }))
}

function toRoute(row: TripRow): TripRoute | undefined {
    if (row.route === null || row.distance_m === null || row.duration_s === null) {
        return undefined
    }
    return {
        line: decodeLine(row.route),
        distanceMeters: row.distance_m,
        durationSeconds: row.duration_s,
    }
}

function toTrip(row: TripRow, stops: string[]): Trip {
    return Trip.reconstitute({
        id: row.id,
        businessId: row.business_id,
        courierId: row.courier_id,
        stops,
        route: toRoute(row),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
}

function routeValues(trip: Trip): (string | number | null)[] {
    const { route } = trip
    return [
        route ? encodeLine(route.line) : null,
        route?.distanceMeters ?? null,
        route?.durationSeconds ?? null,
    ]
}

/** Trips in D1; their stops are the orders' `trip_id` and `trip_stop` (cancelled ones left out). */
export class D1TripRepository implements TripRepository {
    constructor(private readonly db: D1Database) {}

    async insert(trip: Trip): Promise<void> {
        await this.db
            .prepare(`INSERT INTO trips (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
                trip.id,
                trip.businessId,
                trip.courierId,
                ...routeValues(trip),
                trip.createdAt.getTime(),
                trip.updatedAt.getTime(),
            )
            .run()
    }

    async save(trip: Trip): Promise<void> {
        await this.db
            .prepare(
                "UPDATE trips SET route = ?, distance_m = ?, duration_s = ?, updated_at = ? WHERE id = ?",
            )
            .bind(...routeValues(trip), trip.updatedAt.getTime(), trip.id)
            .run()
    }

    async findById(id: string): Promise<Trip | null> {
        const row = await this.db
            .prepare(`SELECT ${COLUMNS} FROM trips WHERE id = ?`)
            .bind(id)
            .first<TripRow>()
        if (!row) {
            return null
        }
        const stops = await this.stopsOf([row.id])
        return toTrip(row, stops.get(row.id) ?? [])
    }

    listOpenByBusiness(businessId: string): Promise<Trip[]> {
        return this.listOpen(OPEN_TRIPS_OF_BUSINESS_SQL, [businessId, ...ACTIVE_ORDER_STATUSES])
    }

    listOpenByCouriers(courierIds: readonly string[]): Promise<Trip[]> {
        if (courierIds.length === 0) {
            return Promise.resolve([])
        }
        return this.listOpen(openTripsOfCouriersSql(courierIds.length), [
            ...courierIds,
            ...ACTIVE_ORDER_STATUSES,
        ])
    }

    /** Trips with at least one order still on the way, newest first. */
    private async listOpen(sql: string, values: string[]): Promise<Trip[]> {
        const { results } = await this.db
            .prepare(sql)
            .bind(...values)
            .all<TripRow>()
        const stops = await this.stopsOf(results.map((r) => r.id))
        return results.map((row) => toTrip(row, stops.get(row.id) ?? []))
    }

    private async stopsOf(tripIds: readonly string[]): Promise<Map<string, string[]>> {
        const stops = new Map<string, string[]>()
        if (tripIds.length === 0) {
            return stops
        }
        const { results } = await this.db
            .prepare(
                `SELECT id, trip_id FROM orders
                 WHERE trip_id IN (${placeholders(tripIds.length)}) AND status != ?
                 ORDER BY trip_id, trip_stop`,
            )
            .bind(...tripIds, OrderStatus.CANCELLED)
            .all<StopRow>()
        for (const row of results) {
            stops.set(row.trip_id, [...(stops.get(row.trip_id) ?? []), row.id])
        }
        return stops
    }
}
