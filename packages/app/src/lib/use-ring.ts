import { useEffect, useRef } from "react"

import { hasNews } from "./arrivals.js"
import { playZumda } from "./sound.js"

import type { Snapshot } from "./arrivals.js"
import type { ZumdaSound } from "./sound.js"

/**
 * Rings the Zumda sound when the list on screen gets news since the last look: a new item, or
 * an item whose state `rings`. `scope` names the list: another list starts a fresh look.
 */
export function useRingOnNews(
    scope: string,
    snapshot: Snapshot | null,
    kind: ZumdaSound,
    rings?: (state: string) => boolean,
): void {
    const previous = useRef<{ scope: string; snapshot: Snapshot } | null>(null)
    const ringsRef = useRef(rings)
    ringsRef.current = rings
    useEffect(() => {
        if (snapshot === null) {
            return
        }
        const before = previous.current?.scope === scope ? previous.current.snapshot : null
        if (hasNews(before, snapshot, ringsRef.current)) {
            playZumda(kind, kind === "order")
        }
        previous.current = { scope, snapshot }
    }, [scope, snapshot, kind])
}
