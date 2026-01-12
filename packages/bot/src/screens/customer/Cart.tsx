import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { CartItem } from "../../components/cart/CartItem.js"
import { CartSummary } from "../../components/cart/CartSummary.js"
import { Layout } from "../../components/layout/Layout.js"
import { Button } from "../../components/ui/Button.js"
import { useCart } from "../../hooks/useCart.js"
import { hapticFeedback } from "../../lib/telegram.js"

export function Cart(): ReactNode {
    const navigate = useNavigate()
    const { items, isEmpty, clear } = useCart()

    const handleCheckout = (): void => {
        hapticFeedback("medium")
        void navigate("/checkout")
    }

    const handleClear = (): void => {
        clear()
    }

    const handleContinueShopping = (): void => {
        void navigate(-1)
    }

    if (isEmpty) {
        return (
            <Layout title="Корзина" showBack>
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <div className="text-6xl mb-4">🛒</div>
                    <h2 className="text-xl font-semibold text-telegram-text mb-2">Корзина пуста</h2>
                    <p className="text-telegram-hint text-center mb-6">
                        Добавьте товары из каталога
                    </p>
                    <Button onClick={handleContinueShopping}>Перейти к покупкам</Button>
                </div>
            </Layout>
        )
    }

    return (
        <Layout title="Корзина" showBack showNav={false}>
            <div className="p-4 pb-32">
                {/* Clear button */}
                <div className="flex justify-end mb-3">
                    <button
                        onClick={handleClear}
                        className="text-sm text-red-500 hover:text-red-600"
                    >
                        Очистить
                    </button>
                </div>

                {/* Cart Items */}
                <div className="space-y-3 mb-4">
                    {items.map((item) => (
                        <CartItem key={item.product.id} item={item} />
                    ))}
                </div>

                {/* Summary */}
                <CartSummary />
            </div>

            {/* Checkout Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-telegram-bg border-t border-telegram-secondary safe-area-pb">
                <Button fullWidth size="lg" onClick={handleCheckout}>
                    Оформить заказ
                </Button>
            </div>
        </Layout>
    )
}
