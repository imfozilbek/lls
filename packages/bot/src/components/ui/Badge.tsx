import { type HTMLAttributes, forwardRef } from "react"

import { cn } from "../../lib/utils.js"

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "info"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-telegram-secondary text-telegram-text",
    primary: "bg-telegram-button/20 text-telegram-button",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = "default", ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    variantStyles[variant],
                    className,
                )}
                {...props}
            />
        )
    },
)

Badge.displayName = "Badge"

// Order status specific badge
type OrderStatusVariant =
    | "PENDING"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "PICKED_UP"
    | "DELIVERED"
    | "CANCELLED"

interface OrderStatusBadgeProps {
    status: OrderStatusVariant | string
    className?: string
}

const statusVariants: Record<OrderStatusVariant, BadgeVariant> = {
    PENDING: "warning",
    ACCEPTED: "info",
    PREPARING: "info",
    READY: "success",
    PICKED_UP: "primary",
    DELIVERED: "success",
    CANCELLED: "danger",
}

const statusLabels: Record<OrderStatusVariant, string> = {
    PENDING: "Ожидает",
    ACCEPTED: "Принят",
    PREPARING: "Готовится",
    READY: "Готов",
    PICKED_UP: "В пути",
    DELIVERED: "Доставлен",
    CANCELLED: "Отменён",
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps): React.ReactNode {
    const variant = statusVariants[status as OrderStatusVariant] || "default"
    const label = statusLabels[status as OrderStatusVariant] || status

    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    )
}
