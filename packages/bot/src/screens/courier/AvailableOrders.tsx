import { type ReactNode, useEffect } from "react"
import { useNavigate } from "react-router-dom"

import { Layout } from "../../components/layout/Layout.js"
import { Badge } from "../../components/ui/Badge.js"
import { Button } from "../../components/ui/Button.js"
import { Card } from "../../components/ui/Card.js"
import { Skeleton } from "../../components/ui/Loading.js"
import { hapticFeedback, hapticNotification } from "../../lib/telegram.js"
import { formatMoney, formatRelativeTime } from "../../lib/utils.js"
import { useCourierStore } from "../../stores/courier.store.js"

// eslint-disable-next-line max-lines-per-function
export function AvailableOrders(): ReactNode {
    const navigate = useNavigate()
    const availableOrders = useCourierStore((state) => state.availableOrders)
    const currentDelivery = useCourierStore((state) => state.currentDelivery)
    const isLoading = useCourierStore((state) => state.isLoading)
    const error = useCourierStore((state) => state.error)
    const fetchAvailableOrders = useCourierStore((state) => state.fetchAvailableOrders)
    const fetchMyOrders = useCourierStore((state) => state.fetchMyOrders)
    const takeOrder = useCourierStore((state) => state.takeOrder)

    useEffect(() => {
        void fetchAvailableOrders()
        void fetchMyOrders()
    }, [fetchAvailableOrders, fetchMyOrders])

    const handleTakeOrder = async (orderId: string): Promise<void> => {
        hapticFeedback("medium")
        try {
            await takeOrder(orderId)
            hapticNotification("success")
            void navigate(`/courier/delivery/${orderId}`)
        } catch {
            hapticNotification("error")
        }
    }

    const handleViewHistory = (): void => {
        hapticFeedback("light")
        void navigate("/courier/history")
    }

    // If courier has active delivery, show prompt to complete it
    if (currentDelivery) {
        return (
            <Layout title="Доступные заказы" showNav={false}>
                <div className="p-4">
                    <div className="p-6 bg-telegram-button/10 rounded-xl text-center">
                        <div className="text-4xl mb-3">🚚</div>
                        <h2 className="text-lg font-semibold text-telegram-text mb-2">
                            У вас есть активная доставка
                        </h2>
                        <p className="text-sm text-telegram-hint mb-4">
                            Завершите текущую доставку, чтобы взять новый заказ
                        </p>
                        <Button
                            fullWidth
                            onClick={(): void => {
                                void navigate(`/courier/delivery/${currentDelivery.id}`)
                            }}
                        >
                            Перейти к доставке
                        </Button>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout
            title="Доступные заказы"
            showNav={false}
            headerRight={
                <button onClick={handleViewHistory} className="p-2 text-telegram-button">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </button>
            }
        >
            <div className="p-4">
                {error && (
                    <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Refresh Button */}
                <div className="flex justify-end mb-3">
                    <button
                        onClick={(): void => void fetchAvailableOrders()}
                        disabled={isLoading}
                        className="flex items-center gap-1 text-sm text-telegram-button"
                    >
                        <svg
                            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        Обновить
                    </button>
                </div>

                {isLoading && availableOrders.length === 0 ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-xl bg-telegram-secondary">
                                <Skeleton className="h-5 w-32 mb-2" />
                                <Skeleton className="h-4 w-48 mb-3" />
                                <Skeleton className="h-10 w-full rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : availableOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh]">
                        <div className="text-5xl mb-4">📭</div>
                        <h2 className="text-xl font-semibold text-telegram-text mb-2">
                            Нет доступных заказов
                        </h2>
                        <p className="text-telegram-hint text-center">
                            Новые заказы появятся здесь
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {availableOrders.map((order) => (
                            <Card key={order.id}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="font-semibold text-telegram-text">
                                            Заказ #{order.id.slice(-6).toUpperCase()}
                                        </p>
                                        <p className="text-xs text-telegram-hint">
                                            {formatRelativeTime(order.createdAt)}
                                        </p>
                                    </div>
                                    <Badge variant="success">
                                        {formatMoney(order.total.amount, order.total.currency)}
                                    </Badge>
                                </div>

                                {/* Delivery Address */}
                                <div className="flex items-start gap-2 text-sm text-telegram-hint mb-3">
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

                                {/* Items summary */}
                                <div className="text-sm text-telegram-hint mb-3">
                                    {order.items.length} позиций
                                </div>

                                <Button
                                    fullWidth
                                    loading={isLoading}
                                    onClick={(): void => {
                                        void handleTakeOrder(order.id)
                                    }}
                                >
                                    Взять заказ
                                </Button>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    )
}
