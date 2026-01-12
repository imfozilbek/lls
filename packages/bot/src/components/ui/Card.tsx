import { type HTMLAttributes, forwardRef } from "react"

import { cn } from "../../lib/utils.js"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    interactive?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, interactive = false, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-xl bg-telegram-secondary p-4",
                    interactive && "cursor-pointer active:scale-[0.98] transition-transform",
                    className,
                )}
                {...props}
            >
                {children}
            </div>
        )
    },
)

Card.displayName = "Card"

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className, ...props }, ref) => {
        return (
            <div ref={ref} className={cn("flex items-center gap-3 mb-3", className)} {...props} />
        )
    },
)

CardHeader.displayName = "CardHeader"

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ className, ...props }, ref) => {
        return (
            <h3
                ref={ref}
                className={cn("font-semibold text-telegram-text", className)}
                {...props}
            />
        )
    },
)

CardTitle.displayName = "CardTitle"

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
    ({ className, ...props }, ref) => {
        return <div ref={ref} className={cn("text-telegram-text", className)} {...props} />
    },
)

CardContent.displayName = "CardContent"
