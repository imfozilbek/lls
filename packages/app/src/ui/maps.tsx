import { Suspense, lazy, useMemo, useState } from "react"

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { HOME_POINT, loadMapKit, useMapReady } from "../lib/map.js"
import { haptic } from "../lib/telegram.js"

import { CheckIcon, PinIcon } from "./icons.js"

import type { Point } from "../lib/map.js"
import type { MapMarker, MapPickerProps, MapShowProps, Zone } from "./map/kit.js"
import type { ReactNode } from "react"

/**
 * The map in the main bundle is only these doors: MapLibre itself loads with the first map
 * (`ui/map/kit.ts`). With no map file yet, every place works as before (`fallback`).
 */
const LazyPicker = lazy(() => loadMapKit().then((kit) => ({ default: kit.MapPicker })))
const LazyPreview = lazy(() => loadMapKit().then((kit) => ({ default: kit.MapPreview })))
const LazyViewer = lazy(() => loadMapKit().then((kit) => ({ default: kit.MapViewer })))

export type { MapMarker, Zone }

function MapLoading(): React.JSX.Element {
    const t = useT()
    return (
        <div
            className="fixed inset-0 z-viewer flex items-center justify-center bg-tg-bg text-tg-hint"
            role="status"
        >
            {t.map.loading}
        </div>
    )
}

export function MapPicker(props: MapPickerProps): React.JSX.Element {
    return (
        <Suspense fallback={<MapLoading />}>
            <LazyPicker {...props} />
        </Suspense>
    )
}

/** A small map of where (the shop, the customer, a trip); nothing while there is no map. */
export function MapPreview(
    props: MapShowProps & { className?: string; footer?: ReactNode },
): React.JSX.Element | null {
    const ready = useMapReady()
    if (!ready) {
        return null
    }
    return (
        <Suspense
            fallback={
                <div
                    className={cn("rounded-tile bg-tg-secondary", props.className ?? "h-40")}
                    aria-hidden
                />
            }
        >
            <LazyPreview {...props} />
        </Suspense>
    )
}

export interface PlacePickProps {
    value: Point | null
    onChange(point: Point): void
    /** Where the map opens with no point yet: the shop, the district; else Yakkabog'. */
    start?: Point | null
    zone?: Zone | null
    markers?: MapMarker[]
    title?: string
    /** Before the map exists: the old way (the place from Telegram). */
    fallback: ReactNode
    /** How the picked place shows in the small map above the button. */
    pin?: "shop" | "customer"
}

/** «Xaritada belgilash»: the place picked on our map; the button turns green once it is set. */
export function PlacePick({
    value,
    onChange,
    start,
    zone,
    markers,
    title,
    fallback,
    pin = "customer",
}: PlacePickProps): React.JSX.Element {
    const t = useT()
    const ready = useMapReady()
    const [open, setOpen] = useState(false)
    const shown = useMemo(
        (): MapMarker[] =>
            value
                ? [
                      ...(markers ?? []),
                      { id: "picked", point: value, kind: pin, title: t.map.picked },
                  ]
                : [],
        [value, markers, pin, t],
    )
    if (!ready) {
        return <>{fallback}</>
    }
    return (
        <>
            {value ? (
                <MapPreview
                    className="h-32"
                    fit={[value]}
                    zone={zone}
                    markers={shown}
                    label={t.map.picked}
                />
            ) : null}
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    setOpen(true)
                }}
                onPointerEnter={(): void => void loadMapKit()}
                className={cn(
                    "tap flex h-12 items-center justify-center gap-2 rounded-control font-medium text-tg-text transition-colors duration-200",
                    value ? "bg-success/15" : "bg-tg-secondary",
                )}
            >
                {value ? (
                    <CheckIcon size={20} className="text-success" />
                ) : (
                    <PinIcon size={20} className="text-brand" />
                )}
                {value ? `${t.map.picked} · ${t.map.change}` : t.map.pick}
            </button>
            {open ? (
                <MapPicker
                    start={value ?? start ?? HOME_POINT}
                    zone={zone}
                    markers={markers}
                    title={title}
                    onPick={(point): void => {
                        onChange(point)
                        setOpen(false)
                    }}
                    onClose={(): void => setOpen(false)}
                />
            ) : null}
        </>
    )
}

/**
 * An order on the map: the shop (where it is picked up) and the customer (where it goes), both
 * in view. Either may be missing; with neither there is no map.
 */
export function OrderMap({
    shop,
    customer,
    zone,
    className,
}: {
    shop?: Point | null
    customer?: Point | null
    zone?: Zone | null
    className?: string
}): React.JSX.Element | null {
    const t = useT()
    const markers = useMemo(() => orderMarkers(t, shop, customer), [t, shop, customer])
    const fit = useMemo(() => markers.map((m) => m.point), [markers])
    if (markers.length === 0) {
        return null
    }
    return (
        <MapPreview
            className={className ?? "h-36"}
            fit={fit}
            markers={markers}
            zone={zone}
            label={t.map.open}
        />
    )
}

function orderMarkers(
    t: ReturnType<typeof useT>,
    shop: Point | null | undefined,
    customer: Point | null | undefined,
): MapMarker[] {
    const list: MapMarker[] = []
    if (shop) {
        list.push({ id: "shop", point: shop, kind: "shop", title: t.map.shop })
    }
    if (customer) {
        list.push({ id: "customer", point: customer, kind: "customer", title: t.map.customer })
    }
    return list
}

/**
 * A button that opens our map on the whole screen (one live map per card of a list would be too
 * many). `href`: the outside map (Yandex) for the way there, shown under our map, and the
 * button's own target while our map does not exist yet.
 */
export function MapButton({
    markers,
    zone,
    href,
    label,
    className,
    children,
}: {
    markers: MapMarker[]
    zone?: Zone | null
    href?: string
    label: string
    className: string
    children: ReactNode
}): React.JSX.Element | null {
    const ready = useMapReady()
    const [open, setOpen] = useState(false)
    const fit = useMemo(
        () =>
            zone && markers.length < 2
                ? [...markers.map((m) => m.point), ...zoneEdges(zone)]
                : markers.map((m) => m.point),
        [markers, zone],
    )
    if (!ready) {
        return href ? (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={className}
            >
                {children}
            </a>
        ) : null
    }
    return (
        <>
            <button
                type="button"
                aria-label={label}
                className={className}
                onClick={(): void => {
                    haptic.tap()
                    setOpen(true)
                }}
            >
                {children}
            </button>
            {open ? (
                <Suspense fallback={<MapLoading />}>
                    <LazyViewer
                        fit={fit}
                        markers={markers}
                        zone={zone}
                        label={label}
                        onClose={(): void => setOpen(false)}
                        footer={href ? <ExternalMapLink href={href} /> : undefined}
                    />
                </Suspense>
            ) : null}
        </>
    )
}

function ExternalMapLink({ href }: { href: string }): React.JSX.Element {
    const t = useT()
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="tap flex h-12 items-center justify-center gap-2 rounded-control bg-tg-secondary font-semibold"
        >
            <PinIcon size={18} className="text-brand" />
            {t.map.external}
        </a>
    )
}

/** North and south ends of a zone: fitting them shows the whole circle. */
function zoneEdges(zone: Zone): Point[] {
    const dLat = zone.radiusMeters / 111_320
    return [
        { latitude: zone.center.latitude + dLat, longitude: zone.center.longitude },
        { latitude: zone.center.latitude - dLat, longitude: zone.center.longitude },
    ]
}

/** The map button of an order in a list: the shop and the customer. */
export function OrderMapButton({
    shop,
    customer,
    href,
    className,
    children,
}: {
    shop?: Point | null
    customer: Point
    href: string
    className: string
    children: ReactNode
}): React.JSX.Element | null {
    const t = useT()
    const markers = useMemo(() => orderMarkers(t, shop, customer), [t, shop, customer])
    return (
        <MapButton markers={markers} href={href} label={t.owner.map} className={className}>
            {children}
        </MapButton>
    )
}
