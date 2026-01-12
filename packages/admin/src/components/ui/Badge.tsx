import { cn, getOrderStatusLabel, getOrderStatusColor } from "../../lib/utils.js"

import type { ReactNode, HTMLAttributes } from "react"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: "default" | "success" | "warning" | "danger" | "info"
    children: ReactNode
}

export function Badge({
    variant = "default",
    children,
    className,
    ...props
}: BadgeProps): ReactNode {
    const variants = {
        default: "bg-gray-100 text-gray-800",
        success: "bg-green-100 text-green-800",
        warning: "bg-yellow-100 text-yellow-800",
        danger: "bg-red-100 text-red-800",
        info: "bg-blue-100 text-blue-800",
    }

    return (
        <span
            className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                variants[variant],
                className,
            )}
            {...props}
        >
            {children}
        </span>
    )
}

interface OrderStatusBadgeProps {
    status: string
    className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps): ReactNode {
    return (
        <span
            className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                getOrderStatusColor(status),
                className,
            )}
        >
            {getOrderStatusLabel(status)}
        </span>
    )
}

interface AvailabilityBadgeProps {
    isAvailable: boolean
    className?: string
}

export function AvailabilityBadge({ isAvailable, className }: AvailabilityBadgeProps): ReactNode {
    return (
        <span
            className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                isAvailable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800",
                className,
            )}
        >
            {isAvailable ? "В наличии" : "Нет в наличии"}
        </span>
    )
}
