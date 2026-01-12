import { OrderStatus } from "@lls/core"
import { useEffect, useMemo } from "react"

import { Layout } from "../components/layout/Layout.js"
import { Card, CardTitle } from "../components/ui/Card.js"
import { TableSkeleton } from "../components/ui/Loading.js"
import { formatMoney, isToday } from "../lib/utils.js"
import { useAuthStore } from "../stores/auth.store.js"
import { useOrdersStore } from "../stores/orders.store.js"

import type { ReactNode } from "react"

// eslint-disable-next-line max-lines-per-function
export function Dashboard(): ReactNode {
    const business = useAuthStore((state) => state.business)
    const orders = useOrdersStore((state) => state.orders)
    const isLoading = useOrdersStore((state) => state.isLoading)
    const fetchOrders = useOrdersStore((state) => state.fetchOrders)

    useEffect(() => {
        if (business) {
            void fetchOrders(business.id)
        }
    }, [business, fetchOrders])

    const stats = useMemo(() => {
        const todayOrders = orders.filter((o) => isToday(o.createdAt))
        const pendingOrders = orders.filter((o) => o.status === OrderStatus.PENDING)
        const completedToday = todayOrders.filter((o) => o.status === OrderStatus.DELIVERED)
        const revenueToday = completedToday.reduce((sum, o) => sum + o.total.amount, 0)

        return {
            ordersToday: todayOrders.length,
            pendingCount: pendingOrders.length,
            completedToday: completedToday.length,
            revenueToday,
        }
    }, [orders])

    return (
        <Layout>
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Главная</h1>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Заказов сегодня"
                        value={stats.ordersToday}
                        icon="📋"
                        color="blue"
                    />
                    <StatCard
                        title="Ожидают обработки"
                        value={stats.pendingCount}
                        icon="⏳"
                        color="yellow"
                    />
                    <StatCard
                        title="Выполнено сегодня"
                        value={stats.completedToday}
                        icon="✅"
                        color="green"
                    />
                    <StatCard
                        title="Выручка сегодня"
                        value={formatMoney(stats.revenueToday)}
                        icon="💰"
                        color="emerald"
                    />
                </div>

                {/* Recent Orders */}
                <Card>
                    <div className="px-4 py-3 border-b border-gray-200">
                        <CardTitle>Последние заказы</CardTitle>
                    </div>
                    <div className="p-4">
                        {isLoading ? (
                            <TableSkeleton rows={5} cols={4} />
                        ) : orders.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-4xl mb-2">📭</p>
                                <p className="text-gray-500">Пока нет заказов</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orders.slice(0, 5).map((order) => (
                                    <div
                                        key={order.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                #{order.id.slice(-6).toUpperCase()}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {order.items.length} позиций
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium">
                                                {formatMoney(
                                                    order.total.amount,
                                                    order.total.currency,
                                                )}
                                            </p>
                                            <p className="text-sm text-gray-500">{order.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </Layout>
    )
}

interface StatCardProps {
    title: string
    value: string | number
    icon: string
    color: "blue" | "yellow" | "green" | "emerald"
}

function StatCard({ title, value, icon, color }: StatCardProps): ReactNode {
    const colors = {
        blue: "bg-blue-50 text-blue-600",
        yellow: "bg-yellow-50 text-yellow-600",
        green: "bg-green-50 text-green-600",
        emerald: "bg-emerald-50 text-emerald-600",
    }

    return (
        <Card>
            <div className="flex items-center gap-4">
                <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${colors[color]}`}
                >
                    {icon}
                </div>
                <div>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
            </div>
        </Card>
    )
}
