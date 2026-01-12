import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { hapticFeedback } from "../../lib/telegram.js"
import { formatMoney, formatRelativeTime } from "../../lib/utils.js"
import { OrderStatusBadge } from "../ui/Badge.js"
import { Card } from "../ui/Card.js"

import type { OrderDTO } from "@lls/core"

interface OrderCardProps {
    order: OrderDTO
}

export function OrderCard({ order }: OrderCardProps): ReactNode {
    const navigate = useNavigate()

    const handleClick = (): void => {
        hapticFeedback("light")
        void navigate(`/order/${order.id}`)
    }

    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

    return (
        <Card interactive onClick={handleClick}>
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-sm text-telegram-hint">
                        Заказ #{order.id.slice(-6).toUpperCase()}
                    </p>
                    <p className="text-xs text-telegram-hint mt-0.5">
                        {formatRelativeTime(order.createdAt)}
                    </p>
                </div>
                <OrderStatusBadge status={order.status} />
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-telegram-text">
                    {itemCount} {itemCount === 1 ? "товар" : itemCount < 5 ? "товара" : "товаров"}
                </div>
                <div className="font-semibold text-telegram-text">
                    {formatMoney(order.total.amount, order.total.currency)}
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-telegram-bg">
                <div className="flex items-center gap-2 text-sm text-telegram-hint">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <span className="truncate">
                        {order.deliveryAddress.street}, {order.deliveryAddress.city}
                    </span>
                </div>
            </div>
        </Card>
    )
}
