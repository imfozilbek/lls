import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { useCart } from "../../hooks/useCart.js"
import { hapticFeedback } from "../../lib/telegram.js"
import { formatMoney } from "../../lib/utils.js"

interface CartButtonProps {
    currency?: string
}

export function CartButton({ currency = "UZS" }: CartButtonProps): ReactNode {
    const navigate = useNavigate()
    const { itemCount, total, isEmpty } = useCart()

    if (isEmpty) {
        return null
    }

    const handleClick = (): void => {
        hapticFeedback("light")
        void navigate("/cart")
    }

    return (
        <button
            onClick={handleClick}
            className="fixed bottom-20 left-4 right-4 z-30 flex items-center justify-between p-4 bg-telegram-button text-telegram-buttonText rounded-xl shadow-lg active:scale-[0.98] transition-transform"
        >
            <div className="flex items-center gap-3">
                <div className="relative">
                    <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                    </svg>
                    <span className="absolute -top-2 -right-2 min-w-[20px] h-5 flex items-center justify-center bg-white text-telegram-button text-xs font-bold rounded-full px-1">
                        {itemCount}
                    </span>
                </div>
                <span className="font-medium">Корзина</span>
            </div>
            <span className="font-bold">{formatMoney(total, currency)}</span>
        </button>
    )
}
