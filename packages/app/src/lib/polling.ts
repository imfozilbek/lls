import { useEffect, useRef } from "react"

import { isAppActive, onAppActive } from "./telegram.js"

/**
 * `run` that skips a call while the last one is still going, so a slow network never piles up
 * ticks. `force` runs anyway (the app came back: its data now, whatever an old tick waits on).
 * A failure (no network for a moment) just waits for the next call: never an unhandled
 * rejection, which the crash reporter would send to the admins.
 */
export function singleFlight(run: () => unknown): (force?: boolean) => void {
    let running = 0
    return (force = false): void => {
        if (running > 0 && !force) {
            return
        }
        running += 1
        void Promise.resolve()
            .then(run)
            .catch(() => undefined)
            .finally(() => {
                running -= 1
            })
    }
}

/**
 * Keeps a screen fresh the calm way: every `ms` while the app is on screen (never while it is
 * collapsed or in the background), and at once when it comes back. `enabled: false` stops both.
 * A tick still waiting on the network is never joined by the next one.
 */
export function usePolling(reload: () => unknown, ms: number, enabled = true): void {
    const latest = useRef(reload)
    latest.current = reload
    useEffect(() => {
        if (!enabled) {
            return undefined
        }
        const tick = singleFlight(() => latest.current())
        const timer = window.setInterval(() => {
            if (isAppActive()) {
                tick()
            }
        }, ms)
        const stop = onAppActive(() => tick(true))
        return (): void => {
            window.clearInterval(timer)
            stop()
        }
    }, [ms, enabled])
}
