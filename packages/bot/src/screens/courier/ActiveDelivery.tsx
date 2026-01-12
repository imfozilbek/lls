import { OrderStatus } from "@lls/core"
import { type ReactNode, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { Layout } from "../../components/layout/Layout.js"
import { OrderStatusBadge } from "../../components/ui/Badge.js"
import { Button } from "../../components/ui/Button.js"
import { Card } from "../../components/ui/Card.js"
import { Loading } from "../../components/ui/Loading.js"
import { useOrder } from "../../hooks/useApi.js"
import { hapticFeedback, hapticNotification } from "../../lib/telegram.js"
import { formatMoney } from "../../lib/utils.js"
import { useCourierStore } from "../../stores/courier.store.js"

// eslint-disable-next-line max-lines-per-function
export function ActiveDelivery(): ReactNode {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { data: order, isLoading, error, refetch } = useOrder(id)
    const completeDelivery = useCourierStore((state) => state.completeDelivery)
    const isCompleting = useCourierStore((state) => state.isLoading)

    // Poll for updates
    useEffect(() => {
        if (!order || order.status === OrderStatus.DELIVERED) {
            return
        }

        const interval = setInterval(() => {
            void refetch()
        }, 30000)

        return (): void => clearInterval(interval)
    }, [order, refetch])

    const handleComplete = async (): Promise<void> => {
        if (!id) {
            return
        }

        hapticFeedback("heavy")
        try {
            await completeDelivery(id)
            hapticNotification("success")
            void navigate("/courier")
        } catch {
            hapticNotification("error")
        }
    }

    const handleBack = (): void => {
        void navigate("/courier")
    }

    if (isLoading) {
        return (
            <Layout title="Доставка" showNav={false}>
                <Loading fullScreen text="Загрузка..." />
            </Layout>
        )
    }

    if (error || !order) {
        return (
            <Layout title="Доставка" showBack showNav={false}>
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-4xl mb-3">❌</div>
                    <p className="text-telegram-hint">{error || "Заказ не найден"}</p>
                </div>
            </Layout>
        )
    }

    const isDelivered = order.status === OrderStatus.DELIVERED

    return (
        <Layout showNav={false}>
            <div className="p-4 pb-32">
                {/* Order Header */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold text-telegram-text">
                        Заказ #{order.id.slice(-6).toUpperCase()}
                    </h1>
                    <div className="mt-2">
                        <OrderStatusBadge status={order.status} />
                    </div>
                </div>

                {/* Success Message */}
                {isDelivered && (
                    <div className="text-center mb-6 p-6 bg-green-50 rounded-xl">
                        <div className="text-5xl mb-3">✅</div>
                        <h2 className="text-lg font-semibold text-green-800">
                            Доставка завершена!
                        </h2>
                    </div>
                )}

                {/* Delivery Address - Prominent */}
                <Card className="mb-4 border-2 border-telegram-button">
                    <h2 className="font-semibold text-telegram-text mb-3 flex items-center gap-2">
                        <svg
                            className="w-5 h-5 text-telegram-button"
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
                        Адрес доставки
                    </h2>
                    <p className="text-lg text-telegram-text">{order.deliveryAddress.street}</p>
                    <p className="text-telegram-hint">{order.deliveryAddress.city}</p>

                    {/* Map link placeholder */}
                    <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(
                            `${order.deliveryAddress.street}, ${order.deliveryAddress.city}`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-sm text-telegram-button"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                        </svg>
                        Открыть в картах
                    </a>
                </Card>

                {/* Order Items */}
                <Card className="mb-4">
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
                </Card>

                {/* Customer Info */}
                <Card>
                    <h2 className="font-semibold text-telegram-text mb-3">Клиент</h2>
                    <div className="text-sm text-telegram-hint">
                        ID: {order.customerId.slice(-8).toUpperCase()}
                    </div>
                </Card>
            </div>

            {/* Action Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-telegram-bg border-t border-telegram-secondary safe-area-pb space-y-2">
                {!isDelivered ? (
                    <Button fullWidth size="lg" loading={isCompleting} onClick={handleComplete}>
                        ✓ Подтвердить доставку
                    </Button>
                ) : (
                    <Button fullWidth size="lg" onClick={handleBack}>
                        Вернуться к заказам
                    </Button>
                )}
            </div>
        </Layout>
    )
}
