import { type ButtonHTMLAttributes, forwardRef } from "react"

import { cn } from "../../lib/utils.js"

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    loading?: boolean
    fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: "bg-telegram-button text-telegram-buttonText hover:opacity-90",
    secondary: "bg-telegram-secondary text-telegram-text hover:opacity-90",
    outline: "border border-telegram-hint text-telegram-text hover:bg-telegram-secondary",
    ghost: "text-telegram-text hover:bg-telegram-secondary",
    danger: "bg-red-500 text-white hover:bg-red-600",
}

const sizeStyles: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "primary",
            size = "md",
            loading = false,
            fullWidth = false,
            disabled,
            children,
            ...props
        },
        ref,
    ) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg font-medium",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    variantStyles[variant],
                    sizeStyles[size],
                    fullWidth && "w-full",
                    className,
                )}
                disabled={disabled || loading}
                {...props}
            >
                {loading && (
                    <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                )}
                {children}
            </button>
        )
    },
)

Button.displayName = "Button"
