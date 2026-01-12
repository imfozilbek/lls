import { useEffect } from "react"

import {
    SalesChart,
    TopProductsList,
    OrderBreakdown,
    PeriodSelector,
} from "../components/analytics/index.js"
import { Layout } from "../components/layout/Layout.js"
import { Card, CardTitle } from "../components/ui/Card.js"
import { FullScreenLoading } from "../components/ui/Loading.js"
import { formatMoney } from "../lib/utils.js"
import { useAnalyticsStore } from "../stores/analytics.store.js"
import { useAuthStore } from "../stores/auth.store.js"

import type { AnalyticsDashboardDTO, AnalyticsPeriod } from "@lls/core"
import type { ReactNode } from "react"

export function Dashboard(): ReactNode {
    const business = useAuthStore((state) => state.business)
    const dashboard = useAnalyticsStore((state) => state.dashboard)
    const period = useAnalyticsStore((state) => state.period)
    const isLoading = useAnalyticsStore((state) => state.isLoading)
    const error = useAnalyticsStore((state) => state.error)
    const fetchDashboard = useAnalyticsStore((state) => state.fetchDashboard)
    const setPeriod = useAnalyticsStore((state) => state.setPeriod)

    useEffect(() => {
        if (business) {
            void fetchDashboard(business.id)
        }
    }, [business, period, fetchDashboard])

    if (isLoading && !dashboard) {
        return (
            <Layout>
                <FullScreenLoading text="Загрузка аналитики..." />
            </Layout>
        )
    }

    return (
        <Layout>
            <DashboardContent
                dashboard={dashboard}
                period={period}
                error={error}
                isLoading={isLoading}
                onPeriodChange={setPeriod}
            />
        </Layout>
    )
}

interface DashboardContentProps {
    dashboard: AnalyticsDashboardDTO | null
    period: AnalyticsPeriod
    error: string | null
    isLoading: boolean
    onPeriodChange: (period: AnalyticsPeriod) => void
}

function DashboardContent({
    dashboard,
    period,
    error,
    isLoading,
    onPeriodChange,
}: DashboardContentProps): ReactNode {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
                <PeriodSelector value={period} onChange={onPeriodChange} />
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                </div>
            )}

            {dashboard && <DashboardCharts dashboard={dashboard} />}

            {!dashboard && !isLoading && !error && (
                <div className="text-center py-12">
                    <p className="text-4xl mb-4">📊</p>
                    <p className="text-gray-500">Нет данных для отображения</p>
                </div>
            )}
        </div>
    )
}

function DashboardCharts({ dashboard }: { dashboard: AnalyticsDashboardDTO }): ReactNode {
    return (
        <>
            <StatsGrid dashboard={dashboard} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <div className="p-4 border-b border-gray-200">
                        <CardTitle>График продаж</CardTitle>
                    </div>
                    <div className="p-4">
                        <SalesChart data={dashboard.salesChart.data} />
                    </div>
                </Card>

                <Card>
                    <div className="p-4 border-b border-gray-200">
                        <CardTitle>Топ товаров</CardTitle>
                    </div>
                    <div className="p-4">
                        <TopProductsList products={dashboard.topProducts.products} />
                    </div>
                </Card>
            </div>

            <Card>
                <div className="p-4 border-b border-gray-200">
                    <CardTitle>Статусы заказов</CardTitle>
                </div>
                <div className="p-4">
                    <OrderBreakdown breakdown={dashboard.orderBreakdown} />
                </div>
            </Card>
        </>
    )
}

function StatsGrid({ dashboard }: { dashboard: AnalyticsDashboardDTO }): ReactNode {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Выручка"
                value={formatMoney(
                    dashboard.stats.totalRevenue.amount,
                    dashboard.stats.totalRevenue.currency,
                )}
                icon="💰"
                color="emerald"
            />
            <StatCard title="Заказов" value={dashboard.stats.totalOrders} icon="📋" color="blue" />
            <StatCard
                title="Выполнено"
                value={dashboard.stats.completedOrders}
                icon="✅"
                color="green"
            />
            <StatCard
                title="Средний чек"
                value={formatMoney(
                    dashboard.stats.averageOrderValue.amount,
                    dashboard.stats.averageOrderValue.currency,
                )}
                icon="📊"
                color="purple"
            />
        </div>
    )
}

interface StatCardProps {
    title: string
    value: string | number
    icon: string
    color: "blue" | "green" | "emerald" | "purple"
}

function StatCard({ title, value, icon, color }: StatCardProps): ReactNode {
    const colors = {
        blue: "bg-blue-50 text-blue-600",
        green: "bg-green-50 text-green-600",
        emerald: "bg-emerald-50 text-emerald-600",
        purple: "bg-purple-50 text-purple-600",
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
