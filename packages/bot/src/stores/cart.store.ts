import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ProductDTO } from "@lls/core"

export interface CartItem {
    product: ProductDTO
    quantity: number
}

interface CartState {
    items: CartItem[]
    businessId: string | null
}

interface CartActions {
    add: (product: ProductDTO, quantity?: number) => void
    remove: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clear: () => void
    getTotal: () => number
    getItemCount: () => number
}

type CartStore = CartState & CartActions

const initialState: CartState = {
    items: [],
    businessId: null,
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            add: (product: ProductDTO, quantity = 1): void => {
                const { items, businessId } = get()

                // If cart has items from different business, clear it
                if (businessId && businessId !== product.businessId) {
                    set({
                        items: [{ product, quantity }],
                        businessId: product.businessId,
                    })
                    return
                }

                const existingIndex = items.findIndex((item) => item.product.id === product.id)

                if (existingIndex >= 0) {
                    const newItems = [...items]
                    const existingItem = newItems[existingIndex]
                    if (existingItem) {
                        newItems[existingIndex] = {
                            product: existingItem.product,
                            quantity: existingItem.quantity + quantity,
                        }
                        set({ items: newItems })
                    }
                } else {
                    set({
                        items: [...items, { product, quantity }],
                        businessId: product.businessId,
                    })
                }
            },

            remove: (productId: string): void => {
                const { items } = get()
                const newItems = items.filter((item) => item.product.id !== productId)
                set({
                    items: newItems,
                    businessId: newItems.length > 0 ? get().businessId : null,
                })
            },

            updateQuantity: (productId: string, quantity: number): void => {
                if (quantity <= 0) {
                    get().remove(productId)
                    return
                }

                const { items } = get()
                const newItems = items.map((item) =>
                    item.product.id === productId ? { ...item, quantity } : item,
                )
                set({ items: newItems })
            },

            clear: (): void => {
                set(initialState)
            },

            getTotal: (): number => {
                const { items } = get()
                return items.reduce(
                    (sum, item) => sum + item.product.price.amount * item.quantity,
                    0,
                )
            },

            getItemCount: (): number => {
                const { items } = get()
                return items.reduce((sum, item) => sum + item.quantity, 0)
            },
        }),
        {
            name: "lls-cart",
            partialize: (state) => ({
                items: state.items,
                businessId: state.businessId,
            }),
        },
    ),
)
