import { OrderStatus, type OrderDTO } from "@lls/core"
import { create } from "zustand"

import { courierApi } from "../lib/api-client.js"

interface CourierState {
    isOnline: boolean
    availableOrders: OrderDTO[]
    currentDelivery: OrderDTO | null
    myOrders: OrderDTO[]
    isLoading: boolean
    error: string | null
}

interface CourierActions {
    setOnlineStatus: (isOnline: boolean) => void
    fetchAvailableOrders: () => Promise<void>
    fetchMyOrders: () => Promise<void>
    takeOrder: (orderId: string) => Promise<void>
    completeDelivery: (orderId: string) => Promise<void>
    reset: () => void
}

type CourierStore = CourierState & CourierActions

const initialState: CourierState = {
    isOnline: false,
    availableOrders: [],
    currentDelivery: null,
    myOrders: [],
    isLoading: false,
    error: null,
}

export const useCourierStore = create<CourierStore>((set, get) => ({
    ...initialState,

    setOnlineStatus: (isOnline: boolean): void => {
        set({ isOnline })
    },

    fetchAvailableOrders: async (): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
            const orders = await courierApi.getAvailableOrders()
            set({ availableOrders: orders, isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to fetch orders"
            set({ error: message, isLoading: false })
        }
    },

    fetchMyOrders: async (): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
            const orders = await courierApi.getMyOrders()
            const currentDelivery = orders.find(
                (o) => o.status === OrderStatus.PICKED_UP || o.status === OrderStatus.READY,
            )
            set({
                myOrders: orders,
                currentDelivery: currentDelivery || null,
                isLoading: false,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to fetch orders"
            set({ error: message, isLoading: false })
        }
    },

    takeOrder: async (orderId: string): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
            const order = await courierApi.takeOrder(orderId)
            set({
                currentDelivery: order,
                availableOrders: get().availableOrders.filter((o) => o.id !== orderId),
                myOrders: [order, ...get().myOrders],
                isLoading: false,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to take order"
            set({ error: message, isLoading: false })
        }
    },

    completeDelivery: async (orderId: string): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
            const order = await courierApi.completeDelivery(orderId)
            set({
                currentDelivery: null,
                myOrders: get().myOrders.map((o) => (o.id === orderId ? order : o)),
                isLoading: false,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to complete delivery"
            set({ error: message, isLoading: false })
        }
    },

    reset: (): void => {
        set(initialState)
    },
}))
