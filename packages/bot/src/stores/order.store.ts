import { create } from "zustand"

import { orderApi } from "../lib/api-client.js"

import { useCartStore } from "./cart.store.js"

import type { OrderDTO } from "@lls/core"

interface OrderState {
    orders: OrderDTO[]
    activeOrder: OrderDTO | null
    isLoading: boolean
    error: string | null
}

interface OrderActions {
    fetchMyOrders: () => Promise<void>
    fetchOrder: (orderId: string) => Promise<void>
    createOrder: (data: {
        customerId: string
        businessId: string
        deliveryAddress: { street: string; city: string }
    }) => Promise<OrderDTO>
    cancelOrder: (orderId: string) => Promise<void>
    clearActiveOrder: () => void
    reset: () => void
}

type OrderStore = OrderState & OrderActions

const initialState: OrderState = {
    orders: [],
    activeOrder: null,
    isLoading: false,
    error: null,
}

export const useOrderStore = create<OrderStore>((set, get) => ({
    ...initialState,

    fetchMyOrders: async (): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
            const orders = await orderApi.getMyOrders()
            set({ orders, isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to fetch orders"
            set({ error: message, isLoading: false })
        }
    },

    fetchOrder: async (orderId: string): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
            const order = await orderApi.getById(orderId)
            set({ activeOrder: order, isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to fetch order"
            set({ error: message, isLoading: false })
        }
    },

    createOrder: async (data): Promise<OrderDTO> => {
        set({ isLoading: true, error: null })

        try {
            const cart = useCartStore.getState()
            const items = cart.items.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPrice: {
                    amount: item.product.price.amount,
                    currency: item.product.price.currency,
                },
            }))

            const order = await orderApi.create({
                customerId: data.customerId,
                businessId: data.businessId,
                items,
                deliveryAddress: data.deliveryAddress,
            })

            cart.clear()
            set({
                activeOrder: order,
                orders: [order, ...get().orders],
                isLoading: false,
            })

            return order
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create order"
            set({ error: message, isLoading: false })
            throw error
        }
    },

    cancelOrder: async (orderId: string): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
            const order = await orderApi.cancel(orderId)
            set({
                activeOrder: order,
                orders: get().orders.map((o) => (o.id === orderId ? order : o)),
                isLoading: false,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to cancel order"
            set({ error: message, isLoading: false })
        }
    },

    clearActiveOrder: (): void => {
        set({ activeOrder: null })
    },

    reset: (): void => {
        set(initialState)
    },
}))
