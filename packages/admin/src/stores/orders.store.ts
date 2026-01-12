import { create } from "zustand"

import { orderApi } from "../lib/api-client.js"

import type { OrderDTO } from "@lls/core"

interface OrdersState {
    orders: OrderDTO[]
    selectedOrder: OrderDTO | null
    isLoading: boolean
    error: string | null
    statusFilter: string | null
    fetchOrders: (businessId: string) => Promise<void>
    setStatusFilter: (status: string | null) => void
    updateOrderStatus: (orderId: string, status: string) => Promise<void>
    selectOrder: (order: OrderDTO | null) => void
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
    orders: [],
    selectedOrder: null,
    isLoading: false,
    error: null,
    statusFilter: null,

    fetchOrders: async (businessId: string): Promise<void> => {
        const { statusFilter } = get()
        set({ isLoading: true, error: null })
        try {
            const orders = await orderApi.listByBusiness(businessId, statusFilter || undefined)
            set({ orders, isLoading: false })
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось загрузить заказы"
            set({ error: message, isLoading: false })
        }
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
