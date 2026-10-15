import { useMemo, useState } from "react"

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { HOME_POINT, loadMapKit, useMapReady } from "../lib/map.js"
import { haptic } from "../lib/telegram.js"

import { CheckIcon, PinIcon } from "./icons.js"
import { MapPicker, MapPreview } from "./maps.js"

import type { Point } from "../lib/map.js"
import type { MapMarker, Zone } from "./map/kit.js"
import type { ReactNode } from "react"

/*
 * Picking a place is for the checkout, the application and the settings, all lazy: kept out of
 * `maps.tsx`, which the storefront loads for its «Xarita» button.
 */

export interface PlacePickProps {
    value: Point | null
    /** The picked point, and the street the map knows there (it may fill the address). */
    onChange(point: Point, street?: string): void
    /** Where the map opens with no point yet: the shop, the district; else Yakkabog'. */
    start?: Point | null
    zone?: Zone | null
    markers?: MapMarker[]
    title?: string
    /** Before the map exists: the old way (the place from Telegram). */
    fallback: ReactNode
    /** How the picked place shows in the small map above the button. */
    pin?: "shop" | "customer"
    /** The one-tap way, shown first while nothing is picked (the place from Telegram). */
    quick?: ReactNode
    /** A pick right next to this place is asked about first (the shop itself). */
    warnNear?: { point: Point; ask: string }
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
    quick,
    warnNear,
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
            {value ? null : quick}
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
                    locateOnOpen={value === null}
                    warnNear={warnNear}
                    onPick={(point, street): void => {
                        onChange(point, street)
                        setOpen(false)
                    }}
                    onClose={(): void => setOpen(false)}
                />
            ) : null}
        </>
    )
}
