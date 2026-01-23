import { OrderStatus } from "@lls/core"
import { type ReactNode, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { Layout } from "../../components/layout/Layout.js"
import { OrderTimeline } from "../../components/order/OrderTimeline.js"
import { Button } from "../../components/ui/Button.js"
import { Loading } from "../../components/ui/Loading.js"
import { useOrder } from "../../hooks/useApi.js"
import { useOrderUpdates } from "../../hooks/useOrderUpdates.js"
import { hapticNotification } from "../../lib/telegram.js"
import { formatMoney, formatDate } from "../../lib/utils.js"
import { useOrderStore } from "../../stores/order.store.js"

// eslint-disable-next-line max-lines-per-function
export function OrderTracking(): ReactNode {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { data: order, isLoading, error, refetch } = useOrder(id)
    const cancelOrder = useOrderStore((state) => state.cancelOrder)
    const isCancelling = useOrderStore((state) => state.isLoading)

    // Subscribe to real-time order updates via WebSocket
    useOrderUpdates(id ?? null)

    // Fallback: Poll for updates every 30 seconds if WebSocket is not available
    useEffect(() => {
        if (
            !order ||
            order.status === OrderStatus.DELIVERED ||
            order.status === OrderStatus.CANCELLED
        ) {
            return
        }

        const interval = setInterval(() => {
            void refetch()
        }, 30000)

        return (): void => clearInterval(interval)
    }, [order, refetch])

    const handleCancel = async (): Promise<void> => {
        if (!id) {
            return
        }

        try {
            await cancelOrder(id)
            hapticNotification("warning")
            void refetch()
        } catch {
            hapticNotification("error")
        }
    }

    const handleBackToHome = (): void => {
        void navigate("/")
    }

    if (isLoading) {
        return (
            <Layout title="Заказ" showBack showNav={false}>
                <Loading fullScreen text="Загрузка заказа..." />
            </Layout>
        )
    }

    if (error || !order) {
        return (
            <Layout title="Заказ" showBack showNav={false}>
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-4xl mb-3">❌</div>
                    <p className="text-telegram-hint">{error || "Заказ не найден"}</p>
                </div>
            </Layout>
        )
    }

    const canCancel = order.status === OrderStatus.PENDING
    const isCompleted =
        order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED

    return (
        <Layout showBack showNav={false}>
            <div className="p-4">
                {/* Order Header */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold text-telegram-text">
                        Заказ #{order.id.slice(-6).toUpperCase()}
                    </h1>
                    <p className="text-sm text-telegram-hint mt-1">{formatDate(order.createdAt)}</p>
                </div>

                {/* Success Animation for completed orders */}
                {order.status === OrderStatus.DELIVERED && (
                    <div className="text-center mb-6 p-6 bg-green-50 rounded-xl">
                        <div className="text-5xl mb-3">🎉</div>
                        <h2 className="text-lg font-semibold text-green-800">Заказ доставлен!</h2>
                        <p className="text-sm text-green-600 mt-1">Спасибо за заказ</p>
                    </div>
                )}

                {/* Order Timeline */}
                <div className="mb-6 p-4 bg-telegram-secondary rounded-xl">
                    <h2 className="font-semibold text-telegram-text mb-4">Статус заказа</h2>
                    <OrderTimeline currentStatus={order.status} />
                </div>

                {/* Order Items */}
                <div className="mb-6 p-4 bg-telegram-secondary rounded-xl">
                    <h2 className="font-semibold text-telegram-text mb-3">Состав заказа</h2>
                    <div className="space-y-2">
                        {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                                <span className="text-telegram-text">
                                    {item.productName} × {item.quantity}
                                </span>
                                <span className="text-telegram-hint">
                                    {formatMoney(
                                        item.unitPrice.amount * item.quantity,
                                        item.unitPrice.currency,
                                    )}
                                </span>
                            </div>
                        ))}
                        <div className="pt-2 mt-2 border-t border-telegram-bg flex justify-between font-semibold">
                            <span className="text-telegram-text">Итого</span>
                            <span className="text-telegram-button">
                                {formatMoney(order.total.amount, order.total.currency)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Delivery Address */}
                <div className="mb-6 p-4 bg-telegram-secondary rounded-xl">
                    <h2 className="font-semibold text-telegram-text mb-2">Адрес доставки</h2>
                    <div className="flex items-start gap-2 text-sm text-telegram-hint">
                        <svg
                            className="w-5 h-5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                        <span>
                            {order.deliveryAddress.street}, {order.deliveryAddress.city}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    {canCancel && (
                        <Button
                            variant="danger"
                            fullWidth
                            loading={isCancelling}
                            onClick={handleCancel}
                        >
                            Отменить заказ
                        </Button>
                    )}
                    {isCompleted && (
                        <Button fullWidth onClick={handleBackToHome}>
                            Вернуться на главную
                        </Button>
                    )}
                </div>
            </div>
        </Layout>
    )
}
