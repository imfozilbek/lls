import { type ReactNode } from "react"

import { useCart } from "../../hooks/useCart.js"
import { formatMoney } from "../../lib/utils.js"

import type { CartItem as CartItemType } from "../../stores/cart.store.js"

interface CartItemProps {
    item: CartItemType
}

export function CartItem({ item }: CartItemProps): ReactNode {
    const { updateQuantity, remove } = useCart()
    const { product, quantity } = item
    const itemTotal = product.price.amount * quantity

    const handleIncrement = (): void => {
        updateQuantity(product.id, quantity + 1)
    }

    const handleDecrement = (): void => {
        if (quantity === 1) {
            remove(product.id)
        } else {
            updateQuantity(product.id, quantity - 1)
        }
    }

    const handleRemove = (): void => {
        remove(product.id)
    }

    return (
        <div className="flex items-center gap-3 p-3 bg-telegram-secondary rounded-xl">
            {/* Product Icon */}
            <div className="w-12 h-12 rounded-lg bg-telegram-bg flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📦</span>
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-telegram-text text-sm truncate">{product.name}</h4>
                <p className="text-sm text-telegram-hint">
                    {formatMoney(product.price.amount, product.price.currency)}
                </p>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-1">
                <button
                    onClick={handleDecrement}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-telegram-bg text-telegram-text"
                >
                    {quantity === 1 ? (
                        <svg
                            className="w-4 h-4 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                        </svg>
                    ) : (
                        "−"
                    )}
                </button>
                <span className="w-8 text-center font-medium text-telegram-text">{quantity}</span>
                <button
                    onClick={handleIncrement}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-telegram-bg text-telegram-text"
                >
                    +
                </button>
            </div>

            {/* Item Total */}
            <div className="text-right min-w-[80px]">
                <p className="font-semibold text-telegram-text">
                    {formatMoney(itemTotal, product.price.currency)}
                </p>
            </div>

            {/* Remove Button */}
            <button
                onClick={handleRemove}
                className="p-1 text-telegram-hint hover:text-red-500 transition-colors"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>
    )
}
