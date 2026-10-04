import { useState } from "react"
import { createPortal } from "react-dom"

import { useT } from "../../i18n/index.js"
import { useBackButton, useSuspendMainAction } from "../../lib/main-button.js"
import { haptic } from "../../lib/telegram.js"
import { CloseIcon } from "../icons.js"

import { MapView } from "./map-view.js"

import type { MapMarker, Zone } from "./map-view.js"
import type { Point } from "../../lib/map.js"
import type { ReactNode } from "react"

export interface MapShowProps {
    /** The points the map opens on: all of them in view. */
    fit: Point[]
    markers: MapMarker[]
    zone?: Zone | null
    route?: Point[] | null
    label: string
}

/** The map on the whole screen: moves and zooms, closes by ×, back or the swipe. */
export function MapViewer({
    onClose,
    footer,
    ...map
}: MapShowProps & { onClose(): void; footer?: ReactNode }): React.JSX.Element {
    const t = useT()
    useBackButton(onClose)
    useSuspendMainAction()
    const center = map.fit[0] ?? map.markers[0]?.point
    return createPortal(
        <div
            className="fixed inset-0 z-viewer flex animate-fade-in flex-col bg-tg-bg"
            role="dialog"
            aria-modal
            aria-label={map.label}
        >
            <div className="relative flex-1">
                {center ? <MapView center={center} {...map} className="absolute inset-0" /> : null}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t.map.close}
                    className="tap absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-tg-bg shadow-lg"
                >
                    <CloseIcon size={22} />
                </button>
            </div>
            {footer ? <footer className="pb-safe px-4 pt-3">{footer}</footer> : null}
        </div>,
        document.body,
    )
}

/**
 * A small map in a card: shows where, without moving; a tap opens it on the whole screen.
 * Nothing at all when the map cannot be drawn (no map file yet, no WebGL).
 */
export function MapPreview({
    className = "h-40",
    footer,
    ...map
}: MapShowProps & { className?: string; footer?: ReactNode }): React.JSX.Element | null {
    const t = useT()
    const [open, setOpen] = useState(false)
    const [failed, setFailed] = useState(false)
    const center = map.fit[0] ?? map.markers[0]?.point
    if (failed || !center) {
        return null
    }
    return (
        <>
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    setOpen(true)
                }}
                aria-label={t.map.open}
                className={`tap relative block w-full overflow-hidden rounded-tile ${className}`}
            >
                <MapView
                    center={center}
                    {...map}
                    interactive={false}
                    onFail={(): void => setFailed(true)}
                    className="pointer-events-none absolute inset-0"
                />
            </button>
            {open ? (
                <MapViewer {...map} footer={footer} onClose={(): void => setOpen(false)} />
            ) : null}
        </>
    )
}
