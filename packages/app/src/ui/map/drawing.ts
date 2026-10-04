import type { Point } from "../../lib/map.js"
import type { Feature } from "geojson"

/**
 * A pin on the map. `stop` is a numbered stop of a trip: done ones are gray with a check, the
 * next one is the brand color and lifted, the rest are outlined.
 */
export interface MapMarker {
    id: string
    point: Point
    kind: "shop" | "customer" | "stop"
    /** The stop's number, or a short word. */
    label?: string
    state?: "done" | "next" | "todo"
    /** For screen readers and tests: whose pin this is. */
    title: string
}

const CIRCLE_STEPS = 64
const METERS_PER_DEGREE = 111_320

/** A circle on the map as a polygon (MapLibre draws no geographic circles). */
export function circlePolygon(center: Point, radiusMeters: number): Feature {
    const coordinates: [number, number][] = []
    const latRadius = radiusMeters / METERS_PER_DEGREE
    const lngRadius = latRadius / Math.cos((center.latitude * Math.PI) / 180)
    for (let i = 0; i <= CIRCLE_STEPS; i++) {
        const angle = (i / CIRCLE_STEPS) * 2 * Math.PI
        coordinates.push([
            center.longitude + lngRadius * Math.cos(angle),
            center.latitude + latRadius * Math.sin(angle),
        ])
    }
    return {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [coordinates] },
    }
}

const SHOP_GLYPH =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/></svg>'
const CHECK_GLYPH =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'

function markerClasses(marker: MapMarker): string {
    const base =
        "zumda-pin flex items-center justify-center rounded-full border-2 border-white font-bold shadow-lg"
    if (marker.kind === "shop") {
        return `${base} h-9 w-9 bg-tg-text text-white`
    }
    if (marker.kind === "customer") {
        return `${base} h-8 w-8 bg-brand text-brand-ink`
    }
    if (marker.state === "done") {
        return `${base} h-8 w-8 bg-tg-hint text-white opacity-80`
    }
    if (marker.state === "next") {
        return `${base} h-10 w-10 bg-brand text-lg text-brand-ink ring-4 ring-brand/25`
    }
    return `${base} h-8 w-8 bg-white text-brand`
}

/** The pin's DOM (MapLibre moves it with the map). Text goes in as text, never as HTML. */
export function markerElement(marker: MapMarker): HTMLElement {
    const element = document.createElement("div")
    element.className = markerClasses(marker)
    element.setAttribute("role", "img")
    element.setAttribute("aria-label", marker.title)
    element.dataset["marker"] = marker.kind
    if (marker.state) {
        element.dataset["state"] = marker.state
    }
    if (marker.kind === "shop") {
        element.insertAdjacentHTML("beforeend", SHOP_GLYPH)
    } else if (marker.state === "done") {
        element.insertAdjacentHTML("beforeend", CHECK_GLYPH)
    } else {
        element.textContent = marker.label ?? ""
    }
    if (marker.kind === "stop" && marker.state === "todo") {
        element.style.borderColor = "currentColor"
    }
    return element
}
