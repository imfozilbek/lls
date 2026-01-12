import { formatMoney } from "../../lib/utils.js"

import type { DailySalesDTO } from "@lls/core"
import type { ReactNode } from "react"

interface SalesChartProps {
    data: DailySalesDTO[]
    className?: string
}

export function SalesChart({ data, className = "" }: SalesChartProps): ReactNode {
    if (data.length === 0) {
        return (
            <div className={`flex items-center justify-center h-64 ${className}`}>
                <p className="text-gray-500">Нет данных для отображения</p>
            </div>
        )
    }

    const maxRevenue = Math.max(...data.map((d) => d.revenue.amount), 1)

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex items-end justify-between h-48 gap-1">
                {data.map((day) => {
                    const height = (day.revenue.amount / maxRevenue) * 100
                    const date = new Date(day.date)
                    const dayName = date.toLocaleDateString("ru-RU", { weekday: "short" })

                    return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full flex flex-col items-center">
                                <span className="text-xs text-gray-600 mb-1">
                                    {day.orderCount > 0 ? day.orderCount : ""}
                                </span>
                                <div
                                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                    style={{
                                        height: `${Math.max(height, 2)}%`,
                                        minHeight: day.revenue.amount > 0 ? "8px" : "2px",
                                    }}
                                    title={`${formatMoney(day.revenue.amount)} (${day.orderCount} заказов)`}
                                />
                            </div>
                            <span className="text-xs text-gray-500">{dayName}</span>
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between text-xs text-gray-500">
                <span>{formatDate(data[0]?.date)}</span>
                <span>{formatDate(data[data.length - 1]?.date)}</span>
            </div>
        </div>
    )
}

function formatDate(dateStr?: string): string {
    if (!dateStr) {
        return ""
    }
    const date = new Date(dateStr)
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}
