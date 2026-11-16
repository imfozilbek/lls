import { Suspense, lazy, useState } from "react"

import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"

import { SheetLoading } from "./boundary.js"
import { PinIcon } from "./icons.js"

import type { RoutePoint } from "@zumda/core"

/** Loaded on the first tap: the apps' sheet stays out of every first download. */
const NavAppsSheet = lazy(() =>
    import("./nav-apps-sheet.js").then((m) => ({ default: m.NavAppsSheet })),
)

const FOCUS =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"

/**
 * «Mijozga yo'l», «Do'konga yo'l», «Yo'lni ochish»: a tap offers the navigation apps for these
 * stops (the last one is where the route ends).
 */
export function RouteButton({
    stops,
    label,
    className,
}: {
    stops: readonly RoutePoint[]
    label: string
    className: string
}): React.JSX.Element | null {
    const [open, setOpen] = useState(false)
    if (stops.length === 0) {
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
                className={cn(className, FOCUS)}
            >
                <PinIcon size={18} className="shrink-0 text-brand" />
                {label}
            </button>
            {open ? (
                <Suspense fallback={<SheetLoading />}>
                    <NavAppsSheet stops={stops} onClose={(): void => setOpen(false)} />
                </Suspense>
            ) : null}
        </>
    )
}
