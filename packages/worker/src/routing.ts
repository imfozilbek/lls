import { z } from "zod"

import type { GeoPoint, RoutePlanner, TripRoute } from "@zumda/core"

const ORS_BASE = "https://api.openrouteservice.org"
/** A trip is planned while the owner waits: never longer than this. */
const TIMEOUT_MS = 5_000

/** The part of OpenRouteService's GeoJSON answer we read. */
const OrsAnswer = z.object({
    features: z
        .array(
            z.object({
                geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])) }),
                properties: z.object({
                    summary: z.object({ distance: z.number(), duration: z.number() }),
                }),
            }),
        )
        .min(1),
})

/**
 * The way along the roads (OpenRouteService `driving-car`), once per trip and per reorder: the
 * free plan has 2,000 a day. No key, an error, a timeout: null, and the app draws straight lines.
 */
export class OrsRoutePlanner implements RoutePlanner {
    constructor(
        private readonly apiKey: string | undefined,
        private readonly base: string = ORS_BASE,
    ) {}

    async route(points: readonly GeoPoint[]): Promise<TripRoute | null> {
        if (!this.apiKey || points.length < 2) {
            return null
        }
        try {
            const response = await fetch(`${this.base}/v2/directions/driving-car/geojson`, {
                method: "POST",
                headers: {
                    Authorization: this.apiKey,
                    "Content-Type": "application/json",
                    Accept: "application/geo+json",
                },
                body: JSON.stringify({ coordinates: points.map((p) => [p.longitude, p.latitude]) }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            })
            if (!response.ok) {
                console.warn(`OpenRouteService: HTTP ${response.status}`)
                return null
            }
            const answer = OrsAnswer.parse(await response.json())
            const [way] = answer.features
            if (!way) {
                return null
            }
            return {
                line: way.geometry.coordinates.map(([longitude, latitude]) => ({
                    latitude,
                    longitude,
                })),
                distanceMeters: Math.round(way.properties.summary.distance),
                durationSeconds: Math.round(way.properties.summary.duration),
            }
        } catch (error) {
            console.warn("OpenRouteService did not answer", error)
            return null
        }
    }
}
