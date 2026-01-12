import { useMemo } from "react"

import { hapticFeedback } from "../lib/telegram.js"
import { useCartStore, type CartItem } from "../stores/cart.store.js"

import type { ProductDTO } from "@lls/core"

interface UseCartResult {
    items: CartItem[]
    businessId: string | null
    itemCount: number
    total: number
    isEmpty: boolean
    add: (product: ProductDTO, quantity?: number) => void
    remove: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clear: () => void
    getItemQuantity: (productId: string) => number
}

export function useCart(): UseCartResult {
    const items = useCartStore((state) => state.items)
    const businessId = useCartStore((state) => state.businessId)
    const addToCart = useCartStore((state) => state.add)
    const removeFromCart = useCartStore((state) => state.remove)
    const updateQuantity = useCartStore((state) => state.updateQuantity)
    const clearCart = useCartStore((state) => state.clear)
    const getTotal = useCartStore((state) => state.getTotal)
    const getItemCount = useCartStore((state) => state.getItemCount)

    const itemCount = useMemo(() => getItemCount(), [items, getItemCount])
    const total = useMemo(() => getTotal(), [items, getTotal])
    const isEmpty = items.length === 0

    const add = (product: ProductDTO, quantity = 1): void => {
        hapticFeedback("light")
        addToCart(product, quantity)
    }

    const remove = (productId: string): void => {
        hapticFeedback("light")
        removeFromCart(productId)
    }

    const update = (productId: string, quantity: number): void => {
        hapticFeedback("light")
        updateQuantity(productId, quantity)
    }

    const clear = (): void => {
        hapticFeedback("medium")
        clearCart()
    }

    const getItemQuantity = (productId: string): number => {
        const item = items.find((i) => i.product.id === productId)
        return item?.quantity || 0
    }

    return {
        items,
        businessId,
        itemCount,
        total,
        isEmpty,
        add,
        remove,
        updateQuantity: update,
        clear,
        getItemQuantity,
    }
}
