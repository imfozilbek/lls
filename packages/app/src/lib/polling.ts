import { useEffect, useRef } from "react"

import { isAppActive, onAppActive } from "./telegram.js"

/**
 * Keeps a screen fresh the calm way: every `ms` while the app is on screen (never while it is
 * collapsed or in the background), and at once when it comes back. `enabled: false` stops both.
 */
export function usePolling(reload: () => unknown, ms: number, enabled = true): void {
    const latest = useRef(reload)
    latest.current = reload
    useEffect(() => {
        if (!enabled) {
            return undefined
        }
        const run = (): void => {
            void latest.current()
        }
        const timer = window.setInterval(() => {
            if (isAppActive()) {
                run()
            }
        }, ms)
        const stop = onAppActive(run)
        return (): void => {
            window.clearInterval(timer)
            stop()
        }
    }, [ms, enabled])
}
