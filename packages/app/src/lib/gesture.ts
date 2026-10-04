/** Pure rules of the page gestures: pull down to refresh, swipe sideways for back and forward. */

/** A finger moves this far before the gesture decides what it is. */
export const DECIDE_PX = 10
/** Sideways means clearly sideways: at least twice as far across as down. */
const SIDEWAYS_RATIO = 2
/** How far the pull indicator travels at most (the finger may go further). */
export const PULL_MAX_PX = 96
/** The indicator must come this far down for a release to refresh. */
export const PULL_TRIGGER_PX = 64
/** The finger moves twice as far as the indicator: it feels like pulling against a spring. */
const PULL_RESISTANCE = 0.5
/** A sideways swipe this long goes back or forward. */
export const SWIPE_TRIGGER_PX = 72
/** The edge bubble follows the finger this far at most. */
export const SWIPE_MAX_PX = 120
/** Android's own back gesture lives in this strip at each edge: we leave it alone. */
export const SYSTEM_EDGE_PX = 12

export type GestureKind = "undecided" | "pull" | "back" | "forward" | "none"

export interface GestureStart {
    /** Pull to refresh may start here: the page is at its top, a screen can refresh. */
    canPull: boolean
    canBack: boolean
    canForward: boolean
}

/** What a finger that moved by (dx, dy) is doing, given what this touch may start. */
export function classify(dx: number, dy: number, start: GestureStart): GestureKind {
    if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) {
        return "undecided"
    }
    if (Math.abs(dx) > SIDEWAYS_RATIO * Math.abs(dy)) {
        if (dx > 0 && start.canBack) {
            return "back"
        }
        if (dx < 0 && start.canForward) {
            return "forward"
        }
        return "none"
    }
    if (dy > 0 && dy > Math.abs(dx) && start.canPull) {
        return "pull"
    }
    return "none"
}

/** How far the pull indicator has come for a finger that moved `dy` down. */
export function pullDistance(dy: number): number {
    return Math.max(0, Math.min(PULL_MAX_PX, dy * PULL_RESISTANCE))
}

/** How far the edge bubble has come for a finger that moved `dx` sideways. */
export function swipeDistance(dx: number): number {
    return Math.min(SWIPE_MAX_PX, Math.abs(dx))
}
