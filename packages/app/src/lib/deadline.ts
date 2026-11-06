/**
 * A request that cannot end by itself: its connection died while the app was in the background,
 * or the regional network stalled. Without a deadline the screen would wait on it forever (a
 * spinner that never stops, a pull that never lets go) until the app is opened again.
 */
export class DeadlineExceeded extends Error {
    constructor() {
        super("Deadline exceeded")
        this.name = "DeadlineExceeded"
    }
}

/**
 * `fetch` that always ends: the request and `read` (its body) have `ms` together, then both are
 * aborted and `DeadlineExceeded` is thrown. Any other failure (no network) is passed on as is.
 */
export async function fetchWithin<T>(
    url: string,
    init: RequestInit,
    ms: number,
    read: (response: Response) => Promise<T>,
): Promise<T> {
    const controller = new AbortController()
    let expired = false
    const timer = setTimeout(() => {
        expired = true
        controller.abort()
    }, ms)
    try {
        const response = await fetch(url, { ...init, signal: controller.signal })
        return await read(response)
    } catch (error) {
        throw expired ? new DeadlineExceeded() : error
    } finally {
        clearTimeout(timer)
    }
}
