import { OrderStatus } from "@lls/core"
import { type ReactNode, useEffect } from "react"

import { Layout } from "../../components/layout/Layout.js"
import { OrderStatusBadge } from "../../components/ui/Badge.js"
import { Card } from "../../components/ui/Card.js"
import { Skeleton } from "../../components/ui/Loading.js"
import { formatMoney, formatDate } from "../../lib/utils.js"
import { useCourierStore } from "../../stores/courier.store.js"

// eslint-disable-next-line max-lines-per-function
export function DeliveryHistory(): ReactNode {
    const myOrders = useCourierStore((state) => state.myOrders)
    const isLoading = useCourierStore((state) => state.isLoading)
    const error = useCourierStore((state) => state.error)
    const fetchMyOrders = useCourierStore((state) => state.fetchMyOrders)

    useEffect(() => {
        void fetchMyOrders()
    }, [fetchMyOrders])

    const completedOrders = myOrders.filter((order) => order.status === OrderStatus.DELIVERED)

    // Calculate stats
    const totalDeliveries = completedOrders.length
    const totalEarnings = completedOrders.reduce(
        (sum, order) => sum + order.total.amount * 0.1, // 10% commission
        0,
    )

    return (
        <Layout title="История доставок" showBack showNav={false}>
            <div className="p-4">
                {error && (
                    <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <Card className="text-center">
                        <p className="text-2xl font-bold text-telegram-button">{totalDeliveries}</p>
                        <p className="text-sm text-telegram-hint">Доставок</p>
                    </Card>
                    <Card className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                            {formatMoney(totalEarnings)}
                        </p>
                        <p className="text-sm text-telegram-hint">Заработано</p>
                    </Card>
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-xl bg-telegram-secondary">
                                <div className="flex justify-between mb-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                                <Skeleton className="h-4 w-32 mb-2" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        ))}
                    </div>
                ) : completedOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[40vh]">
                        <div className="text-5xl mb-4">📋</div>
                        <h2 className="text-xl font-semibold text-telegram-text mb-2">
                            Нет завершённых доставок
                        </h2>
                        <p className="text-telegram-hint text-center">
                            Ваши доставки появятся здесь
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {completedOrders.map((order) => (
                            <Card key={order.id}>
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-medium text-telegram-text">
                                            #{order.id.slice(-6).toUpperCase()}
                                        </p>
                                        <p className="text-xs text-telegram-hint">
                                            {formatDate(order.createdAt)}
                                        </p>
                                    </div>
                                    <OrderStatusBadge status={order.status} />
                                </div>

                                <div className="flex items-start gap-2 text-sm text-telegram-hint mb-2">
                                    <svg
                                        className="w-4 h-4 flex-shrink-0 mt-0.5"
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
                                    </svg>
                                    <span className="truncate">{order.deliveryAddress.street}</span>
                                </div>

                                <div className="flex justify-between pt-2 border-t border-telegram-bg">
                                    <span className="text-sm text-telegram-hint">Сумма заказа</span>
                                    <span className="font-medium text-telegram-text">
                                        {formatMoney(order.total.amount, order.total.currency)}
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    )
}
