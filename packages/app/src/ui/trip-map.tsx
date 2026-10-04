import { useMemo } from "react"

import { fill, useT } from "../i18n/index.js"
import { isStopDone, tripLine } from "../lib/trips.js"

import { MapPreview } from "./maps.js"

import type { MapMarker } from "./maps.js"
import type { Point } from "../lib/map.js"
import type { OrderDTO, TripDTO } from "@zumda/core"

/**
 * A trip on the map: the shop, the stops numbered in order (done ones grey with a check, the
 * next one big in the brand color) and the way between them. A tap opens it on the whole screen.
 */
export function TripMap({
    trip,
    shop,
    stops,
    className,
}: {
    trip: TripDTO | null
    shop: Point | undefined
    /** The orders in the order of the stops. */
    stops: readonly OrderDTO[]
    className?: string
}): React.JSX.Element | null {
    const t = useT()
    const markers = useMemo((): MapMarker[] => {
        const next = stops.find((o) => !isStopDone(o))
        const list: MapMarker[] = stops.flatMap((order, i) =>
            order.location
                ? [
                      {
                          id: order.id,
                          point: order.location,
                          kind: "stop" as const,
                          label: String(i + 1),
                          state: isStopDone(order) ? "done" : order === next ? "next" : "todo",
                          title: fill(t.trip.stop, { n: i + 1 }),
                      },
                  ]
                : [],
        )
        return shop ? [{ id: "shop", point: shop, kind: "shop", title: t.map.shop }, ...list] : list
    }, [stops, shop, t])
    const route = useMemo(() => tripLine(trip, shop, stops), [trip, shop, stops])
    const fit = useMemo(() => markers.map((m) => m.point), [markers])
    if (markers.length === 0) {
        return null
    }
    return (
        <MapPreview
            className={className ?? "h-48"}
            fit={fit}
            markers={markers}
            route={route}
            label={t.trip.open}
        />
    )
}

/** «3,4 km · 12 daqiqa» along the roads, when the road service answered. */
export function TripWay({ trip }: { trip: TripDTO | null }): React.JSX.Element | null {
    const t = useT()
    if (!trip?.route) {
        return null
    }
    const km = (trip.route.distanceMeters / 1000).toFixed(1).replace(".", ",")
    const min = Math.max(1, Math.round(trip.route.durationSeconds / 60))
    return <p className="text-sm text-tg-subtitle">{fill(t.trip.way, { km, min })}</p>
}
