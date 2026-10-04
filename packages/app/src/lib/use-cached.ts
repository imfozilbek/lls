import { useCallback, useState } from "react"

import { scopedKey } from "./api.js"
import { cached, remember } from "./cache.js"

type Next<T> = T | ((current: T | null) => T)

/**
 * `useState` that remembers its value for this session under `key` (scoped to the shop): the
 * screen opened again starts from it and refreshes quietly, never through a skeleton. Another
 * key (a filter, a period) starts from that key's copy, or `null` the very first time.
 */
export function useCachedState<T>(key: string): [T | null, (next: Next<T>) => void] {
    const cacheKey = `state:${scopedKey(key)}`
    const [state, setState] = useState<{ key: string; value: T | null }>(() => ({
        key: cacheKey,
        value: cached<T>(cacheKey) ?? null,
    }))
    const set = useCallback(
        (next: Next<T>): void => {
            setState((current) => {
                const previous = current.key === cacheKey ? current.value : null
                const value =
                    typeof next === "function" ? (next as (current: T | null) => T)(previous) : next
                return { key: cacheKey, value: remember(cacheKey, value) }
            })
        },
        [cacheKey],
    )
    const value = state.key === cacheKey ? state.value : (cached<T>(cacheKey) ?? null)
    return [value, set]
}
