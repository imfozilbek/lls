import { cn } from "../../lib/utils.js"

import type { ReactNode, HTMLAttributes } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode
    padding?: "none" | "sm" | "md" | "lg"
}

export function Card({ children, padding = "md", className, ...props }: CardProps): ReactNode {
    const paddings = {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
    }

    return (
        <div
            className={cn(
                "bg-white rounded-xl border border-gray-200 shadow-sm",
                paddings[padding],
                className,
            )}
            {...props}
        >
            {children}
        </div>
    )
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode
}

export function CardHeader({ children, className, ...props }: CardHeaderProps): ReactNode {
    return (
        <div className={cn("border-b border-gray-200 px-4 py-3", className)} {...props}>
            {children}
        </div>
    )
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
    children: ReactNode
}

export function CardTitle({ children, className, ...props }: CardTitleProps): ReactNode {
    return (
        <h3 className={cn("text-lg font-semibold text-gray-900", className)} {...props}>
            {children}
        </h3>
    )
}
