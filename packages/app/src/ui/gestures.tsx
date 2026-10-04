import { useEffect, useRef, useState } from "react"

import { cn } from "../lib/cn.js"
import {
    PULL_TRIGGER_PX,
    SWIPE_TRIGGER_PX,
    SYSTEM_EDGE_PX,
    classify,
    pullDistance,
    swipeDistance,
} from "../lib/gesture.js"
import { canGoBack, pressBack } from "../lib/main-button.js"
import { canRefresh, runRefresh } from "../lib/refresh.js"
import { webApp } from "../lib/telegram.js"
import { useRouter } from "../stores/router.js"

import { ChevronIcon } from "./icons.js"

import type { GestureKind, GestureStart } from "../lib/gesture.js"

/** The spinner stays at least this long: a refresh that blinks reads as "nothing happened". */
const MIN_REFRESH_MS = 450
/** The indicator rests here while the screen refreshes. */
const REFRESHING_AT_PX = 56

type Haptic = "selection" | "medium" | "success"

function feel(kind: Haptic): void {
    const haptics = webApp()?.HapticFeedback
    if (kind === "selection") {
        haptics?.selectionChanged()
    } else if (kind === "medium") {
        haptics?.impactOccurred("medium")
    } else {
        haptics?.notificationOccurred("success")
    }
}

/** Typing, or a place with its own sideways scrolling: the page gestures stay out of it. */
function ownsTouch(target: Element): { all: boolean; sideways: boolean } {
    if (target.closest("input, textarea, select, [contenteditable], [data-no-gesture]")) {
        return { all: true, sideways: true }
    }
    for (
        let node: Element | null = target;
        node && node !== document.body;
        node = node.parentElement
    ) {
        const overflow = getComputedStyle(node).overflowX
        if (
            (overflow === "auto" || overflow === "scroll") &&
            node.scrollWidth > node.clientWidth + 1
        ) {
            return { all: false, sideways: true }
        }
    }
    return { all: false, sideways: false }
}

function startOf(touch: Touch, target: Element): GestureStart | null {
    const owned = ownsTouch(target)
    if (owned.all) {
        return null
    }
    const width = window.innerWidth
    const nearSystemEdge =
        webApp()?.platform === "android" &&
        (touch.clientX < SYSTEM_EDGE_PX || touch.clientX > width - SYSTEM_EDGE_PX)
    const sideways = !owned.sideways && !nearSystemEdge
    const inDialog = target.closest('[role="dialog"]') !== null
    return {
        canPull: !inDialog && window.scrollY <= 0 && canRefresh(),
        canBack: sideways && canGoBack(),
        // Inside a sheet, "forward" has no meaning: only screens go forward.
        canForward: sideways && !inDialog && useRouter.getState().ahead.length > 0,
    }
}

interface Drag {
    kind: GestureKind
    /** How far the indicator or the bubble has come, px. */
    distance: number
    /** Where the finger is, for the bubble's height. */
    y: number
}

const IDLE: Drag = { kind: "undecided", distance: 0, y: 0 }

/** Listens on the whole page; returns what to draw. */
function useGestures(): { drag: Drag; refreshing: boolean } {
    const [drag, setDrag] = useState<Drag>(IDLE)
    const [refreshing, setRefreshing] = useState(false)
    const live = useRef<{ x: number; y: number; start: GestureStart; drag: Drag } | null>(null)
    const busy = useRef(false)

    useEffect(() => {
        const onStart = (event: TouchEvent): void => {
            const touch = event.touches[0]
            if (event.touches.length !== 1 || !touch || !(event.target instanceof Element)) {
                live.current = null
                return
            }
            const start = startOf(touch, event.target)
            live.current = start ? { x: touch.clientX, y: touch.clientY, start, drag: IDLE } : null
        }

        const onMove = (event: TouchEvent): void => {
            const state = live.current
            const touch = event.touches[0]
            if (!state || !touch) {
                return
            }
            const dx = touch.clientX - state.x
            const dy = touch.clientY - state.y
            let kind = state.drag.kind
            if (kind === "undecided") {
                kind = classify(dx, dy, state.start)
            }
            if (kind === "none") {
                live.current = null
                setDrag(IDLE)
                return
            }
            if (kind === "undecided" || (kind === "pull" && busy.current)) {
                return
            }
            // Ours now: the page does not scroll under the finger.
            event.preventDefault()
            const distance = kind === "pull" ? pullDistance(dy) : swipeDistance(dx)
            const trigger = kind === "pull" ? PULL_TRIGGER_PX : SWIPE_TRIGGER_PX
            if (state.drag.distance < trigger !== distance < trigger) {
                feel("selection")
            }
            state.drag = { kind, distance, y: touch.clientY }
            setDrag(state.drag)
        }

        const onEnd = (): void => {
            const state = live.current
            live.current = null
            setDrag(IDLE)
            if (!state) {
                return
            }
            const { kind, distance } = state.drag
            if (kind === "pull" && distance >= PULL_TRIGGER_PX && !busy.current) {
                busy.current = true
                setRefreshing(true)
                feel("medium")
                const wait = new Promise((resolve) => window.setTimeout(resolve, MIN_REFRESH_MS))
                void Promise.all([runRefresh(), wait])
                    .then(() => feel("success"))
                    .catch(() => undefined)
                    .finally(() => {
                        busy.current = false
                        setRefreshing(false)
                    })
            } else if (kind === "back" && distance >= SWIPE_TRIGGER_PX) {
                feel("medium")
                pressBack()
            } else if (kind === "forward" && distance >= SWIPE_TRIGGER_PX) {
                feel("medium")
                useRouter.getState().forward()
            }
        }

        const options: AddEventListenerOptions = { passive: false }
        window.addEventListener("touchstart", onStart, { passive: true })
        window.addEventListener("touchmove", onMove, options)
        window.addEventListener("touchend", onEnd)
        window.addEventListener("touchcancel", onEnd)
        return (): void => {
            window.removeEventListener("touchstart", onStart)
            window.removeEventListener("touchmove", onMove, options)
            window.removeEventListener("touchend", onEnd)
            window.removeEventListener("touchcancel", onEnd)
        }
    }, [])
    return { drag, refreshing }
}

/** The circle that comes down from the top: an arrow while pulling, a spinner while refreshing. */
function PullIndicator({
    distance,
    refreshing,
}: {
    distance: number
    refreshing: boolean
}): React.JSX.Element | null {
    if (distance === 0 && !refreshing) {
        return null
    }
    const at = refreshing ? REFRESHING_AT_PX : distance
    const ready = refreshing || distance >= PULL_TRIGGER_PX
    return (
        <div
            role="status"
            aria-label="refresh"
            data-testid="pull-indicator"
            className={cn(
                "pointer-events-none fixed left-1/2 top-0 z-bar grid h-10 w-10 place-items-center rounded-full bg-tg-bg shadow-lg ring-1 ring-tg-separator",
                refreshing && "transition-transform duration-200 ease-out-quart",
            )}
            style={{ transform: `translate(-50%, ${at - 44}px)`, opacity: Math.min(1, at / 40) }}
        >
            {refreshing ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand border-r-transparent" />
            ) : (
                <ChevronIcon
                    size={20}
                    className={cn("transition-colors", ready ? "text-brand" : "text-tg-hint")}
                    style={{ transform: `rotate(${90 + (distance / PULL_TRIGGER_PX) * 180}deg)` }}
                />
            )}
        </div>
    )
}

/** The half circle at the edge that follows the finger: "back" on the left, "forward" on the right. */
function EdgeBubble({ drag }: { drag: Drag }): React.JSX.Element | null {
    if ((drag.kind !== "back" && drag.kind !== "forward") || drag.distance === 0) {
        return null
    }
    const back = drag.kind === "back"
    const ready = drag.distance >= SWIPE_TRIGGER_PX
    const shift = Math.min(drag.distance, SWIPE_TRIGGER_PX) * 0.6 - 44
    return (
        <div
            data-testid={back ? "swipe-back" : "swipe-forward"}
            className={cn(
                "pointer-events-none fixed z-bar grid h-11 w-11 place-items-center rounded-full shadow-lg transition-colors duration-150",
                back ? "left-0" : "right-0",
                ready
                    ? "bg-brand text-brand-ink"
                    : "bg-tg-bg text-tg-text ring-1 ring-tg-separator",
            )}
            style={{
                top: drag.y - 22,
                transform: `translateX(${back ? shift : -shift}px) scale(${ready ? 1.08 : 1})`,
            }}
        >
            <ChevronIcon size={20} className={back ? "rotate-180" : undefined} />
        </div>
    )
}

/**
 * The page's own gestures, like a native app: pull down from the top refreshes the screen,
 * a swipe to the right goes back, to the left forward again. Mounted once at the root.
 */
export function Gestures(): React.JSX.Element {
    const { drag, refreshing } = useGestures()
    return (
        <>
            <PullIndicator
                distance={drag.kind === "pull" ? drag.distance : 0}
                refreshing={refreshing}
            />
            <EdgeBubble drag={drag} />
        </>
    )
}
