import { type ReactNode } from "react"

import { useCart } from "../../hooks/useCart.js"
import { hapticFeedback } from "../../lib/telegram.js"
import { formatMoney } from "../../lib/utils.js"
import { Button } from "../ui/Button.js"
import { Card } from "../ui/Card.js"
import { useToast } from "../ui/Toast.js"

import type { ProductDTO } from "@lls/core"

interface ProductCardProps {
    product: ProductDTO
}

export function ProductCard({ product }: ProductCardProps): ReactNode {
    const { add, updateQuantity, getItemQuantity } = useCart()
    const toast = useToast()
    const quantity = getItemQuantity(product.id)

    const handleAdd = (): void => {
        add(product)
        hapticFeedback("light")
        toast.success(`${product.name} добавлен в корзину`)
    }

    const handleIncrement = (): void => {
        updateQuantity(product.id, quantity + 1)
    }

    const handleDecrement = (): void => {
        updateQuantity(product.id, quantity - 1)
    }

    return (
        <Card className="flex flex-col h-full">
            {/* Product Image/Placeholder */}
            <div className="aspect-square rounded-lg bg-telegram-bg flex items-center justify-center mb-3">
                <span className="text-4xl">📦</span>
            </div>

            {/* Product Info */}
            <div className="flex-1 min-h-0">
                <h3 className="font-medium text-telegram-text line-clamp-2 text-sm">
                    {product.name}
                </h3>
                {product.description && (
                    <p className="text-xs text-telegram-hint mt-1 line-clamp-2">
                        {product.description}
                    </p>
                )}
            </div>

            {/* Price and Add Button */}
            <div className="mt-3 pt-3 border-t border-telegram-bg">
                <p className="font-semibold text-telegram-text mb-2">
                    {formatMoney(product.price.amount, product.price.currency)}
                </p>

                {!product.isAvailable ? (
                    <Button disabled fullWidth size="sm">
                        Нет в наличии
                    </Button>
                ) : quantity === 0 ? (
                    <Button onClick={handleAdd} fullWidth size="sm">
                        Добавить
                    </Button>
                ) : (
                    <div className="flex items-center justify-between bg-telegram-button/10 rounded-lg">
                        <button
                            onClick={handleDecrement}
                            className="px-4 py-2 text-telegram-button font-semibold"
                        >
                            −
                        </button>
                        <span className="font-semibold text-telegram-text">{quantity}</span>
                        <button
                            onClick={handleIncrement}
                            className="px-4 py-2 text-telegram-button font-semibold"
                        >
                            +
                        </button>
                    </div>
                )}
            </div>
        </Card>
    )
}
