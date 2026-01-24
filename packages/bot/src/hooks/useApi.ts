import { useState, useEffect, useCallback } from "react"

import { businessApi, productApi, orderApi } from "../lib/api-client.js"

import type { BusinessDTO, ProductDTO, OrderDTO } from "@lls/core"

interface UseQueryResult<T> {
    data: T | null
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function useBusinesses(): UseQueryResult<BusinessDTO[]> {
    const [data, setData] = useState<BusinessDTO[] | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await businessApi.list()
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch businesses")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void refetch()
    }, [refetch])

    return { data, isLoading, error, refetch }
}

export function useBusiness(id: string | undefined): UseQueryResult<BusinessDTO> {
    const [data, setData] = useState<BusinessDTO | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refetch = useCallback(async (): Promise<void> => {
        if (!id) {
            setData(null)
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)
        try {
            const result = await businessApi.getById(id)
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch business")
        } finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        void refetch()
    }, [refetch])

    return { data, isLoading, error, refetch }
}

export function useProducts(businessId: string | undefined): UseQueryResult<ProductDTO[]> {
    const [data, setData] = useState<ProductDTO[] | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refetch = useCallback(async (): Promise<void> => {
        if (!businessId) {
            setData(null)
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)
        try {
            const result = await productApi.listByBusiness(businessId)
            setData(result.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch products")
        } finally {
            setIsLoading(false)
        }
    }, [businessId])

    useEffect(() => {
        void refetch()
    }, [refetch])

    return { data, isLoading, error, refetch }
}

export function useOrder(orderId: string | undefined): UseQueryResult<OrderDTO> {
    const [data, setData] = useState<OrderDTO | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refetch = useCallback(async (): Promise<void> => {
        if (!orderId) {
            setData(null)
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)
        try {
            const result = await orderApi.getById(orderId)
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch order")
        } finally {
            setIsLoading(false)
        }
    }, [orderId])

    useEffect(() => {
        void refetch()
    }, [refetch])

    return { data, isLoading, error, refetch }
}

export function useMyOrders(): UseQueryResult<OrderDTO[]> {
    const [data, setData] = useState<OrderDTO[] | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await orderApi.getMyOrders()
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch orders")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void refetch()
    }, [refetch])

    return { data, isLoading, error, refetch }
}
