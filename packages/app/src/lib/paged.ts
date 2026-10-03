import { useCallback, useEffect, useRef, useState } from "react"

import { ApiError } from "./api.js"

import type { Page } from "@zumda/core"

export interface PagedList<T> {
    /** `null` until the first page arrives. */
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

function codeOf(error: unknown): string {
    return error instanceof ApiError ? error.code : "generic"
}

/**
 * A server list with "load more". `key` identifies the list (e.g. a filter): when it changes,
 * the list starts over, and late answers for the old key are dropped instead of shown.
 */
export function usePagedList<T>(
    key: string,
    load: (page: number) => Promise<Page<T>>,
): PagedList<T> {
    const [items, setItems] = useState<T[] | null>(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
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
            setItems(result.data)
            setTotal(result.meta.total)
            setPage(1)
            setError(null)
        } catch (caught) {
            if (current.current === requested) {
                setError(codeOf(caught))
            }
        }
    }, [key])

    useEffect(() => {
        setItems(null)
        setError(null)
        void reload()
    }, [reload])

    const loadMore = async (): Promise<void> => {
        const requested = key
        setLoadingMore(true)
        try {
            const result = await loader.current(page + 1)
            if (current.current === requested) {
                setItems((list) => [...(list ?? []), ...result.data])
                setTotal(result.meta.total)
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
