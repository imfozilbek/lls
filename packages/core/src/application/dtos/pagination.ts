export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export interface PageRequest {
    page: number
    limit: number
}

export interface PageMeta {
    page: number
    limit: number
    total: number
}

/** The shape of every list response. */
export interface Page<T> {
    data: T[]
    meta: PageMeta
}

/** Clamp user input to a safe page request: page ≥ 1, 1 ≤ limit ≤ 100. */
export function normalizePage(input: { page?: number; limit?: number } = {}): PageRequest {
    const page = Number.isSafeInteger(input.page) && (input.page ?? 0) > 0 ? (input.page ?? 1) : 1
    const rawLimit = Number.isSafeInteger(input.limit) ? (input.limit ?? DEFAULT_PAGE_SIZE) : 0
    const limit = rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE
    return { page, limit }
}

export function offsetOf(request: PageRequest): number {
    return (request.page - 1) * request.limit
}

export function mapPage<A, B>(page: Page<A>, map: (item: A) => B): Page<B> {
    return { data: page.data.map(map), meta: { ...page.meta } }
}

export function emptyPage<T>(request: PageRequest): Page<T> {
    return { data: [], meta: { page: request.page, limit: request.limit, total: 0 } }
}
