import type { OrderStatusBreakdownDTO } from "@lls/core"
import type { ReactNode } from "react"

interface OrderBreakdownProps {
    breakdown: OrderStatusBreakdownDTO
    className?: string
}

const STATUS_CONFIG = [
    { key: "pending", label: "Ожидает", color: "bg-yellow-500" },
    { key: "accepted", label: "Принят", color: "bg-blue-500" },
    { key: "preparing", label: "Готовится", color: "bg-purple-500" },
    { key: "ready", label: "Готов", color: "bg-cyan-500" },
    { key: "pickedUp", label: "Забран", color: "bg-indigo-500" },
    { key: "delivered", label: "Доставлен", color: "bg-green-500" },
    { key: "cancelled", label: "Отменён", color: "bg-red-500" },
] as const

export function OrderBreakdown({ breakdown, className = "" }: OrderBreakdownProps): ReactNode {
    if (breakdown.total === 0) {
        return (
            <div className={`flex items-center justify-center py-8 ${className}`}>
                <p className="text-gray-500">Нет заказов за период</p>
            </div>
        )
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Progress bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
                {STATUS_CONFIG.map(({ key, color }) => {
                    const count = breakdown[key]
                    if (count === 0) {
                        return null
                    }
                    const width = (count / breakdown.total) * 100
                    return (
                        <div
                            key={key}
                            className={`${color} transition-all`}
                            style={{ width: `${width}%` }}
                            title={`${key}: ${count}`}
                        />
                    )
                })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2">
                {STATUS_CONFIG.map(({ key, label, color }) => {
                    const count = breakdown[key]
                    return (
                        <div key={key} className="flex items-center gap-2 text-sm">
                            <div className={`w-3 h-3 rounded-full ${color}`} />
                            <span className="text-gray-600">{label}</span>
                            <span className="font-medium text-gray-900 ml-auto">{count}</span>
                        </div>
                    )
                })}
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                <span className="text-gray-600">Всего заказов</span>
                <span className="font-bold text-gray-900">{breakdown.total}</span>
            </div>
        </div>
    )
}
