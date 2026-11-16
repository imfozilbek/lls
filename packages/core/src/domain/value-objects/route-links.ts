/** A point on the way, in degrees. */
export interface RoutePoint {
    latitude: number
    longitude: number
}

/**
 * The navigation apps a courier, a dispatcher or the owner opens a route in (owner's decision,
 * November 2026). Each link starts where the phone is; the stops go in order, the last one is
 * where the route ends.
 */
export enum NavApp {
    NAVIGATOR = "navigator",
    YANDEX_GO = "yandex-go",
    GOOGLE = "google",
    TWO_GIS = "2gis",
    YANDEX_MAPS = "yandex-maps",
}

/** Google Maps takes the destination and up to nine stops on the way. */
const GOOGLE_MAX_STOPS = 10
/** Yandex Go's link for an app install, from its docs; `ref` names who sent the person there. */
const YANDEX_GO_TRACKING_ID = "1178268795219780156"
const YANDEX_GO_REF = "zumda.shop"

const deg = (value: number): string => value.toFixed(6)

/** Yandex Navigator's own scheme: by car through every stop. */
export function yandexNavigatorUrl(stops: readonly RoutePoint[]): string | null {
    const to = stops.at(-1)
    if (!to) {
        return null
    }
    const params = stops
        .slice(0, -1)
        .flatMap((stop, index) => [
            `lat_via_${index}=${deg(stop.latitude)}`,
            `lon_via_${index}=${deg(stop.longitude)}`,
        ])
    return `yandexnavi://build_route_on_map?${[
        ...params,
        `lat_to=${deg(to.latitude)}`,
        `lon_to=${deg(to.longitude)}`,
    ].join("&")}`
}

/** Yandex Go to one point: a taxi, or a courier of theirs, picked in the app. */
export function yandexGoUrl(stops: readonly RoutePoint[]): string | null {
    const [to] = stops
    if (!to || stops.length > 1) {
        return null
    }
    return (
        `https://3.redirect.appmetrica.yandex.com/route?end-lat=${deg(to.latitude)}` +
        `&end-lon=${deg(to.longitude)}&ref=${YANDEX_GO_REF}` +
        `&appmetrica_tracking_id=${YANDEX_GO_TRACKING_ID}&lang=uz`
    )
}

/** Google Maps by car (`%2C` and `%7C` as its docs ask). */
export function googleMapsUrl(stops: readonly RoutePoint[]): string | null {
    const to = stops.at(-1)
    if (!to || stops.length > GOOGLE_MAX_STOPS) {
        return null
    }
    const point = (p: RoutePoint): string => `${deg(p.latitude)}%2C${deg(p.longitude)}`
    const via = stops.slice(0, -1).map(point).join("%7C")
    return (
        `https://www.google.com/maps/dir/?api=1&destination=${point(to)}&travelmode=driving` +
        (via ? `&waypoints=${via}` : "")
    )
}

/** 2GIS to one point, by car (longitude first, as 2GIS writes it). */
export function twoGisUrl(stops: readonly RoutePoint[]): string | null {
    const [to] = stops
    if (!to || stops.length > 1) {
        return null
    }
    return `https://2gis.uz/routeSearch/rsType/car/to/${deg(to.longitude)},${deg(to.latitude)}`
}

/** Yandex Maps by car: `rtext=~a~b` (the empty start is where the phone is). */
export function yandexMapsUrl(stops: readonly RoutePoint[]): string | null {
    if (stops.length === 0) {
        return null
    }
    const points = stops.map((p) => `${deg(p.latitude)},${deg(p.longitude)}`)
    return `https://yandex.uz/maps/?rtext=~${points.join("~")}&rtt=auto`
}

const BUILDERS: Record<NavApp, (stops: readonly RoutePoint[]) => string | null> = {
    [NavApp.NAVIGATOR]: yandexNavigatorUrl,
    [NavApp.YANDEX_GO]: yandexGoUrl,
    [NavApp.GOOGLE]: googleMapsUrl,
    [NavApp.TWO_GIS]: twoGisUrl,
    [NavApp.YANDEX_MAPS]: yandexMapsUrl,
}

/** The route in one app, or null when the app cannot take it (several stops). */
export function routeUrl(app: NavApp, stops: readonly RoutePoint[]): string | null {
    return BUILDERS[app](stops)
}
