/** What is new between two looks at the same list: the sound plays only for real news. */

/** One item's state, as far as news is concerned (e.g. id → "pending:awaiting"). */
export type Snapshot = ReadonlyMap<string, string>

/**
 * True when `next` has an item `previous` did not, or an item whose state became one of
 * `ringing`. The first look (`previous` null) is never news: it is what was already there.
 */
export function hasNews(
    previous: Snapshot | null,
    next: Snapshot,
    ringing: (state: string) => boolean = (): boolean => true,
): boolean {
    if (previous === null) {
        return false
    }
    for (const [id, state] of next) {
        const before = previous.get(id)
        if (before === undefined || (before !== state && ringing(state))) {
            return true
        }
    }
    return false
}
