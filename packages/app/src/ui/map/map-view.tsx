import "maplibre-gl/dist/maplibre-gl.css"
import "./map.css"
import { LngLatBounds, Map as MapLibre, Marker, addProtocol, setWorkerUrl } from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { Protocol } from "pmtiles"
import { useEffect, useRef, useState } from "react"

import { cn } from "../../lib/cn.js"
import { mapInfo } from "../../lib/map.js"

import { circlePolygon, markerElement } from "./drawing.js"
import { mapStyle } from "./style.js"

import type { MapMarker } from "./drawing.js"
import type { Point } from "../../lib/map.js"
import type { Feature, FeatureCollection, GeoJSON } from "geojson"
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl"

export type { MapMarker }

let ready = false

/** Once per page: the pmtiles:// protocol and MapLibre's worker from our own bundle. */
function setUp(): void {
    if (ready) {
        return
    }
    ready = true
    setWorkerUrl(workerUrl)
    addProtocol("pmtiles", new Protocol().tile)
}

export interface Zone {
    center: Point
    radiusMeters: number
}

export interface MapViewProps {
    /** Where the map opens; `fit` (if given) wins. */
    center: Point
    zoom?: number
    /** Points to show all of at once (a trip, a shop and a customer). */
    fit?: Point[]
    interactive?: boolean
    markers?: MapMarker[]
    zone?: Zone | null
    /** A line along these points (a trip's road, or straight segments). */
    route?: Point[] | null
    /** The map's center after each move (the picker's pin). */
    onMove?(center: Point, moving: boolean): void
    onMap?(map: MapLibre | null): void
    /** No WebGL, no map file, no network: the caller shows its fallback. */
    onFail?(): void
    label: string
    className?: string
}

const DEFAULT_ZOOM = 15
const FIT_PADDING = 48
const FIT_MAX_ZOOM = 16
const ZONE_SOURCE = "zumda-zone"
const ROUTE_SOURCE = "zumda-route"

/** The shop's brand color as MapLibre reads it (`rgb(r, g, b)`). */
function brandColor(): string {
    const rgb = getComputedStyle(document.documentElement).getPropertyValue("--brand-rgb").trim()
    return rgb ? `rgb(${rgb.split(/\s+/).join(", ")})` : "rgb(21, 128, 61)"
}

function lineFeature(points: Point[]): Feature {
    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "LineString",
            coordinates: points.map((p) => [p.longitude, p.latitude]),
        },
    }
}

function emptyCollection(): FeatureCollection {
    return { type: "FeatureCollection", features: [] }
}

/** Our own layers over the base map: the zone circle and the route line. */
function addOverlays(map: MapLibre): void {
    const color = brandColor()
    map.addSource(ZONE_SOURCE, { type: "geojson", data: emptyCollection() })
    map.addLayer({
        id: "zumda-zone-fill",
        type: "fill",
        source: ZONE_SOURCE,
        paint: { "fill-color": color, "fill-opacity": 0.08 },
    })
    map.addLayer({
        id: "zumda-zone-line",
        type: "line",
        source: ZONE_SOURCE,
        paint: { "line-color": color, "line-width": 2, "line-dasharray": [2, 2] },
    })
    map.addSource(ROUTE_SOURCE, { type: "geojson", data: emptyCollection() })
    map.addLayer({
        id: "zumda-route-casing",
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9 },
    })
    map.addLayer({
        id: "zumda-route",
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 5 },
    })
}

function setData(map: MapLibre, source: string, data: GeoJSON): void {
    const target = map.getSource<GeoJSONSource>(source)
    void target?.setData(data)
}

function fitAll(map: MapLibre, points: Point[], animate: boolean): void {
    if (points.length === 0) {
        return
    }
    const bounds = new LngLatBounds()
    for (const point of points) {
        bounds.extend([point.longitude, point.latitude])
    }
    map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate })
}

/** Creates the MapLibre map once the map file's name is known; null until then or on failure. */
function useMapInstance(
    container: React.RefObject<HTMLDivElement | null>,
    props: MapViewProps,
): MapLibre | null {
    const [map, setMap] = useState<MapLibre | null>(null)
    const first = useRef(props)
    useEffect(() => {
        let alive = true
        let created: MapLibre | null = null
        const { center, zoom, interactive = true, onFail } = first.current
        void mapInfo().then((info) => {
            if (!alive || !container.current) {
                return
            }
            if (!info) {
                onFail?.()
                return
            }
            try {
                setUp()
                const style: StyleSpecification = mapStyle(info.file)
                created = new MapLibre({
                    container: container.current,
                    style,
                    center: [center.longitude, center.latitude],
                    zoom: zoom ?? DEFAULT_ZOOM,
                    interactive,
                    attributionControl: { compact: true },
                    dragRotate: false,
                    pitchWithRotate: false,
                    touchPitch: false,
                })
                created.touchZoomRotate.disableRotation()
                created.on("load", () => {
                    if (created) {
                        addOverlays(created)
                        setMap(created)
                    }
                })
            } catch {
                onFail?.()
            }
        })
        return (): void => {
            alive = false
            created?.remove()
            setMap(null)
        }
    }, [container])
    return map
}

function useMarkers(map: MapLibre | null, markers: MapMarker[] | undefined): void {
    useEffect(() => {
        if (!map || !markers) {
            return undefined
        }
        const placed = markers.map((marker) =>
            new Marker({ element: markerElement(marker), anchor: "bottom" })
                .setLngLat([marker.point.longitude, marker.point.latitude])
                .addTo(map),
        )
        return (): void => {
            for (const marker of placed) {
                marker.remove()
            }
        }
    }, [map, markers])
}

/** One map: our base map, a zone circle, a route line and pins. */
export function MapView(props: MapViewProps): React.JSX.Element {
    const { zone, route, fit, markers, onMove, onMap, label, className } = props
    const container = useRef<HTMLDivElement | null>(null)
    const map = useMapInstance(container, props)
    useMarkers(map, markers)

    useEffect(() => {
        onMap?.(map)
    }, [map, onMap])

    useEffect(() => {
        if (map) {
            const data = zone ? circlePolygon(zone.center, zone.radiusMeters) : emptyCollection()
            setData(map, ZONE_SOURCE, data)
        }
    }, [map, zone])

    useEffect(() => {
        if (map) {
            const data = route && route.length > 1 ? lineFeature(route) : emptyCollection()
            setData(map, ROUTE_SOURCE, data)
        }
    }, [map, route])

    const fitKey = fit?.map((p) => `${p.latitude},${p.longitude}`).join(";") ?? ""
    useEffect(() => {
        if (map && fit) {
            fitAll(map, fit, false)
        }
        // Refit only when the points themselves change, not on every new array.
    }, [map, fitKey])

    useEffect(() => {
        if (!map || !onMove) {
            return undefined
        }
        const report = (moving: boolean) => (): void => {
            const center = map.getCenter()
            onMove({ latitude: center.lat, longitude: center.lng }, moving)
        }
        const moving = report(true)
        const stopped = report(false)
        map.on("move", moving)
        map.on("moveend", stopped)
        return (): void => {
            map.off("move", moving)
            map.off("moveend", stopped)
        }
    }, [map, onMove])

    // MapLibre makes its container `position: relative`: the container sits inside our box.
    return (
        <div
            role="img"
            aria-label={label}
            data-no-gesture
            data-map-ready={map ? "true" : undefined}
            className={cn("zumda-map overflow-hidden bg-tg-secondary", className)}
        >
            <div ref={container} className="h-full w-full" />
        </div>
    )
}
