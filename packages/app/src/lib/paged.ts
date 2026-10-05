import { useCallback, useEffect, useRef, useState } from "react"

import { ApiError, scopedKey } from "./api.js"
import { cached, remember } from "./cache.js"

import type { Page } from "@zumda/core"

export interface PagedList<T> {
    /** `null` until the first page arrives (this session's copy shows at once, if any). */
    items: T[] | null
    hasMore: boolean
    loadingMore: boolean
    error: string | null
    /** Reloads the first page (pull fresh data, e.g. on a timer). */
    reload(): Promise<void>
    /** Throws on failure; the list stays as it was. */
    loadMore(): Promise<void>
    update(change: (items: T[]) => T[]): void
}

function idOf(item: unknown): unknown {
    return (item as { id?: unknown }).id ?? item
}

/** The fresh first page, then what «Yana» had opened beyond it (without repeats). */
export function keepOpenedPages<T>(list: T[] | null, first: Page<T>): T[] {
    if (!list || list.length <= first.meta.limit) {
        return first.data
    }
    const fresh = new Set(first.data.map(idOf))
    return [...first.data, ...list.slice(first.meta.limit).filter((item) => !fresh.has(idOf(item)))]
}

/**
 * `total` after a refresh of the first page. An order list's `total` is only a lower bound
 * (offset + shown + 1 when more follow: the server never counts a whole history), so a fresh
 * first page must not hide «Yana» under pages already opened beyond it.
 */
export function totalAfterRefresh<T>(previous: number, kept: number, first: Page<T>): number {
    return kept > first.meta.limit ? Math.max(previous, first.meta.total) : first.meta.total
}

function codeOf(error: unknown): string {
    return error instanceof ApiError ? error.code : "generic"
}

/**
 * A server list with "load more". `key` identifies the list (e.g. a filter): when it changes,
 * the list starts over, and late answers for the old key are dropped instead of shown.
 */
interface Snapshot<T> {
    items: T[]
    total: number
}

export function usePagedList<T>(
    key: string,
    load: (page: number) => Promise<Page<T>>,
): PagedList<T> {
    const cacheKey = `list:${scopedKey(key)}`
    const [items, setItemsState] = useState<T[] | null>(
        () => cached<Snapshot<T>>(cacheKey)?.items ?? null,
    )
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(() => cached<Snapshot<T>>(cacheKey)?.total ?? 0)
    const totalRef = useRef(total)
    totalRef.current = total
    const itemsRef = useRef(items)
    itemsRef.current = items
    /** Every change of the list is this session's copy for the next visit. */
    const setItems = useCallback(
        (change: (list: T[] | null) => T[] | null): void => {
            setItemsState((list) => {
                const next = change(list)
                if (next) {
                    remember<Snapshot<T>>(cacheKey, { items: next, total: totalRef.current })
                }
                return next
            })
        },
        [cacheKey],
    )
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const loader = useRef(load)
    loader.current = load
    const current = useRef(key)
    current.current = key

    const reload = useCallback(async (): Promise<void> => {
        const requested = key
        try {
            const result = await loader.current(1)
            if (current.current !== requested) {
                return
            }
            // A timer refresh keeps the pages the person already opened with «Yana».
            const kept = keepOpenedPages(itemsRef.current, result).length
            const fresh = totalAfterRefresh(totalRef.current, kept, result)
            totalRef.current = fresh
            setTotal(fresh)
            setItems((list) => keepOpenedPages(list, result))
            setError(null)
        } catch (caught) {
            if (current.current === requested) {
                setError(codeOf(caught))
            }
        }
    }, [key, setItems])

    useEffect(() => {
        // Another list: this session's copy of it at once (or the skeleton the first time).
        const snapshot = cached<Snapshot<T>>(cacheKey)
        setItemsState(snapshot?.items ?? null)
        setTotal(snapshot?.total ?? 0)
        setPage(1)
        setError(null)
        void reload()
    }, [reload])

    const loadMore = async (): Promise<void> => {
        const requested = key
        setLoadingMore(true)
        try {
            const result = await loader.current(page + 1)
            if (current.current === requested) {
                totalRef.current = result.meta.total
                setTotal(result.meta.total)
                setItems((list) => [...(list ?? []), ...result.data])
                setPage(page + 1)
            }
        } finally {
            setLoadingMore(false)
        }
    }

    return {
        items,
        hasMore: items !== null && items.length < total,
        loadingMore,
        error,
        reload,
        loadMore,
        update: (change): void => setItems((list) => (list ? change(list) : list)),
    }
}
