import { Location } from "@zumda/core"
import { useEffect, useState } from "react"

import { API_URL } from "./api.js"

/**
 * Zumda's own map (the Worker serves it from R2 under /map): only its name lives in the main
 * bundle. The map itself (MapLibre, ~250 KB) is the lazy `ui/map` chunk, loaded on the first map.
 */
export interface Point {
    latitude: number
    longitude: number
}

/** Yakkabog', the pilot district: where a map opens when nothing nearer is known. */
export const HOME_POINT: Point = { latitude: 38.9785, longitude: 66.6831 }

export interface MapInfo {
    /** `uzbekistan-YYYYMMDD.pmtiles` */
    file: string
}

let info: Promise<MapInfo | null> | undefined

/** Which map file is current; null when there is no map yet (the app works as before). */
export function mapInfo(): Promise<MapInfo | null> {
    info ??= fetch(`${API_URL}/map/current.json`)
        .then(async (response) => (response.ok ? ((await response.json()) as MapInfo) : null))
        .then((found) => (found && typeof found.file === "string" ? found : null))
        .catch(() => {
            // No network now: ask again next time.
            info = undefined
            return null
        })
    return info
}

/** True once the map is known to exist; false while unknown or when there is none. */
export function useMapReady(): boolean {
    const [ready, setReady] = useState(false)
    useEffect(() => {
        let alive = true
        void mapInfo().then((found) => {
            if (alive) {
                setReady(found !== null)
            }
        })
        return (): void => {
            alive = false
        }
    }, [])
    return ready
}

/** The map chunk, loaded ahead (e.g. when checkout opens) so the first map opens at once. */
export const loadMapKit = (): Promise<typeof import("../ui/map/kit.js")> =>
    import("../ui/map/kit.js")

/** Distance in meters on the Earth's surface (the core's own haversine). */
export function metersBetween(a: Point, b: Point): number {
    return Location.create(a.latitude, a.longitude).distanceTo(
        Location.create(b.latitude, b.longitude),
    )
}
