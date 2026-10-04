/**
 * What screens loaded this session, by key: a screen opened again shows it at once and refreshes
 * quietly behind it (stale-while-revalidate), instead of a skeleton blinking over the same data.
 * Memory only: a new session starts fresh.
 */
const store = new Map<string, unknown>()
/** Keys whose content has already appeared once: their lists do not rise in again. */
const shown = new Set<string>()

export function cached<T>(key: string): T | undefined {
    return store.get(key) as T | undefined
}

export function remember<T>(key: string, value: T): T {
    store.set(key, value)
    return value
}

/**
 * True only the first time this key's content appears this session: lists animate in once,
 * not on every return to the screen. Call once per mount (in a `useState` initializer).
 */
export function firstShow(key: string): boolean {
    if (shown.has(key)) {
        return false
    }
    shown.add(key)
    return true
}

/** Tests only: a clean session. */
export function clearCache(): void {
    store.clear()
    shown.clear()
}
