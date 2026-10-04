import { useCallback, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { fill, useT } from "../../i18n/index.js"
import { kmText } from "../../lib/format.js"
import { useBackButton, useSuspendMainAction } from "../../lib/main-button.js"
import { metersBetween } from "../../lib/map.js"
import { getLocation, haptic } from "../../lib/telegram.js"
import { toast } from "../../stores/toast.js"
import { CloseIcon, PinIcon } from "../icons.js"
import { Button } from "../primitives.js"

import { MapView } from "./map-view.js"
import { roadLayerIds } from "./style.js"

import type { MapMarker, Zone } from "./map-view.js"
import type { Point } from "../../lib/map.js"
import type { Map as MapLibre } from "maplibre-gl"

export interface MapPickerProps {
    /** Where the map opens. */
    start: Point
    /** The delivery zone or the district: a point outside it gets a warning. */
    zone?: Zone | null
    /** Pins for orientation (the shop). */
    markers?: MapMarker[]
    title?: string
    onPick(point: Point): void
    onClose(): void
}

const PICK_ZOOM = 16
/** How far around the pin (px) a street name is looked for. */
const STREET_RADIUS = 36

/** The name of the street under the map's center, from the map's own road layer. */
function streetAt(map: MapLibre): string | null {
    const style = map.getStyle()
    const center = map.project(map.getCenter())
    const features = map.queryRenderedFeatures(
        [
            [center.x - STREET_RADIUS, center.y - STREET_RADIUS],
            [center.x + STREET_RADIUS, center.y + STREET_RADIUS],
        ],
        { layers: roadLayerIds(style).filter((id) => map.getLayer(id)) },
    )
    for (const feature of features) {
        const name: unknown = feature.properties["name"]
        if (typeof name === "string" && name.length > 0) {
            return name
        }
    }
    return null
}

/** The picker's state: the point under the pin, the street there, and the map itself. */
function usePickerMap(
    start: Point,
    onPick: (point: Point) => void,
): {
    point: Point
    moving: boolean
    street: string | null
    failed: boolean
    onMove(center: Point, isMoving: boolean): void
    onMap(map: MapLibre | null): void
    onFail(): void
    locate(): Promise<void>
} {
    const t = useT()
    const [point, setPoint] = useState(start)
    const [moving, setMoving] = useState(false)
    const [street, setStreet] = useState<string | null>(null)
    const [failed, setFailed] = useState(false)
    const map = useRef<MapLibre | null>(null)

    const onMove = useCallback((center: Point, isMoving: boolean): void => {
        setPoint(center)
        setMoving(isMoving)
        if (!isMoving) {
            haptic.select()
            setStreet(map.current ? streetAt(map.current) : null)
        }
    }, [])
    const onMap = useCallback((instance: MapLibre | null): void => {
        map.current = instance
        if (instance) {
            instance.once("idle", () => setStreet(streetAt(instance)))
        }
    }, [])
    const onFail = useCallback((): void => setFailed(true), [])

    const locate = async (): Promise<void> => {
        haptic.tap()
        const found = await getLocation()
        if (!found) {
            toast(t.checkout.locationFailed, "error")
            return
        }
        const target = { latitude: found.latitude, longitude: found.longitude }
        if (map.current) {
            map.current.flyTo({ center: [target.longitude, target.latitude], zoom: PICK_ZOOM })
        } else {
            // No map: the place from Telegram is the answer.
            onPick(target)
        }
    }

    return { point, moving, street, failed, onMove, onMap, onFail, locate }
}

/**
 * Picking a place: the pin stays in the middle, the person moves the map under it. No search
 * (owner's decision): «Joylashuvim» flies to where Telegram says the person is.
 */
export function MapPicker({
    start,
    zone,
    markers,
    title,
    onPick,
    onClose,
}: MapPickerProps): React.JSX.Element {
    const t = useT()
    useBackButton(onClose)
    useSuspendMainAction()
    const { point, moving, street, failed, onMove, onMap, onFail, locate } = usePickerMap(
        start,
        onPick,
    )

    const outside = zone ? metersBetween(zone.center, point) > zone.radiusMeters : false

    return createPortal(
        <div
            className="fixed inset-0 z-viewer flex animate-fade-in flex-col bg-tg-bg"
            role="dialog"
            aria-modal
            aria-label={title ?? t.map.title}
            data-point={`${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`}
        >
            <header className="flex items-center gap-2 px-4 pb-2 pt-3">
                <h2 className="flex-1 text-lg font-bold">{title ?? t.map.title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t.map.close}
                    className="tap flex h-10 w-10 items-center justify-center rounded-full bg-tg-secondary"
                >
                    <CloseIcon size={20} />
                </button>
            </header>
            <div className="relative flex-1">
                {failed ? (
                    <p className="p-6 text-center text-tg-hint">{t.map.failed}</p>
                ) : (
                    <>
                        <MapView
                            center={start}
                            zoom={PICK_ZOOM}
                            zone={zone}
                            markers={markers}
                            onMove={onMove}
                            onMap={onMap}
                            onFail={onFail}
                            label={t.map.hint}
                            className="absolute inset-0"
                        />
                        <CenterPin lifted={moving} />
                    </>
                )}
            </div>
            <PickerFooter
                note={
                    outside && zone
                        ? fill(t.map.outsideZone, { km: kmText(zone.radiusMeters) })
                        : street
                          ? fill(t.map.street, { name: street })
                          : t.map.hint
                }
                warn={outside}
                disabled={failed}
                onLocate={(): void => void locate()}
                onPick={(): void => {
                    haptic.success()
                    onPick(point)
                }}
            />
        </div>,
        document.body,
    )
}

function PickerFooter({
    note,
    warn,
    disabled,
    onLocate,
    onPick,
}: {
    note: string
    warn: boolean
    disabled: boolean
    onLocate(): void
    onPick(): void
}): React.JSX.Element {
    const t = useT()
    return (
        <footer className="pb-safe flex flex-col gap-2 px-4 pt-3">
            <p
                className={
                    warn ? "text-sm font-medium text-tg-destructive" : "text-sm text-tg-hint"
                }
                aria-live="polite"
            >
                {note}
            </p>
            <div className="flex gap-2">
                <Button variant="secondary" onClick={onLocate}>
                    {t.map.mine}
                </Button>
                <Button
                    className="flex-1"
                    disabled={disabled}
                    icon={<PinIcon size={20} />}
                    onClick={onPick}
                >
                    {t.map.here}
                </Button>
            </div>
        </footer>
    )
}

/** The pin in the middle: it lifts while the map moves and lands when it stops. */
function CenterPin({ lifted }: { lifted: boolean }): React.JSX.Element {
    return (
        <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full"
            aria-hidden
        >
            <div
                className="transition-transform duration-200 ease-out-quart"
                style={{ transform: lifted ? "translateY(-10px)" : "none" }}
            >
                <svg width="40" height="48" viewBox="0 0 40 48">
                    <path
                        d="M20 2C10.6 2 3 9.4 3 18.6 3 31 20 46 20 46s17-15 17-27.4C37 9.4 29.4 2 20 2Z"
                        className="fill-brand"
                        stroke="white"
                        strokeWidth="3"
                    />
                    <circle cx="20" cy="18.5" r="6" fill="white" />
                </svg>
            </div>
            <div
                className="mx-auto h-1.5 w-4 rounded-full bg-black/25 transition-transform duration-200"
                style={{ transform: lifted ? "scale(1.6)" : "scale(1)" }}
            />
        </div>
    )
}
