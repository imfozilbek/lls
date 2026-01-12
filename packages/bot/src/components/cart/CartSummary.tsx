import { type ReactNode } from "react"

import { useCart } from "../../hooks/useCart.js"
import { formatMoney } from "../../lib/utils.js"

interface CartSummaryProps {
    currency?: string
}

export function CartSummary({ currency = "UZS" }: CartSummaryProps): ReactNode {
    const { items, itemCount, total } = useCart()

    if (items.length === 0) {
        return null
    }

    return (
        <div className="p-4 bg-telegram-secondary rounded-xl">
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-telegram-hint">Товаров:</span>
                    <span className="text-telegram-text">{itemCount} шт.</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-telegram-hint">Доставка:</span>
                    <span className="text-telegram-text">Бесплатно</span>
                </div>
                <div className="pt-2 border-t border-telegram-bg flex justify-between">
                    <span className="font-semibold text-telegram-text">Итого:</span>
                    <span className="font-bold text-lg text-telegram-button">
                        {formatMoney(total, currency)}
                    </span>
                </div>
            </div>
        </div>
    )
}
