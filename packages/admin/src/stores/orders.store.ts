import { create } from "zustand"

import { orderApi } from "../lib/api-client.js"

import type { PaginatedResponse } from "../lib/api-client.js"
import type { OrderDTO } from "@lls/core"

interface PaginationMeta {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
}

interface OrdersState {
    orders: OrderDTO[]
    pagination: PaginationMeta | null
    selectedOrder: OrderDTO | null
    isLoading: boolean
    error: string | null
    statusFilter: string | null
    currentPage: number
    fetchOrders: (businessId: string, page?: number) => Promise<void>
    setStatusFilter: (status: string | null) => void
    setPage: (page: number) => void
    updateOrderStatus: (orderId: string, status: string) => Promise<void>
    selectOrder: (order: OrderDTO | null) => void
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
    orders: [],
    pagination: null,
    selectedOrder: null,
    isLoading: false,
    error: null,
    statusFilter: null,
    currentPage: 1,

    fetchOrders: async (businessId: string, page?: number): Promise<void> => {
        const { statusFilter, currentPage } = get()
        const targetPage = page ?? currentPage
        set({ isLoading: true, error: null })
        try {
            const response: PaginatedResponse<OrderDTO> = await orderApi.listByBusiness(
                businessId,
                statusFilter || undefined,
                { page: targetPage, limit: 20 },
            )
            set({
                orders: response.data,
                pagination: response.meta,
                currentPage: targetPage,
                isLoading: false,
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось загрузить заказы"
            set({ error: message, isLoading: false })
        }
    },

    setPage: (page: number): void => {
        set({ currentPage: page })
    },

    setStatusFilter: (status: string | null): void => {
        set({ statusFilter: status })
    },

    updateOrderStatus: async (orderId: string, status: string): Promise<void> => {
        set({ isLoading: true, error: null })
        try {
            const updated = await orderApi.updateStatus(orderId, status)
            set((state) => ({
                orders: state.orders.map((o) => (o.id === orderId ? updated : o)),
                selectedOrder: state.selectedOrder?.id === orderId ? updated : state.selectedOrder,
                isLoading: false,
            }))
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось обновить статус"
            set({ error: message, isLoading: false })
            throw err
        }
    },

    selectOrder: (order: OrderDTO | null): void => {
        set({ selectedOrder: order })
    },
}))
