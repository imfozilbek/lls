import { type InputHTMLAttributes, forwardRef } from "react"

import { cn } from "../../lib/utils.js"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, id, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s/g, "-")

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-telegram-text mb-1"
                    >
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={cn(
                        "w-full px-3 py-2 rounded-lg",
                        "bg-telegram-secondary text-telegram-text",
                        "border border-transparent",
                        "placeholder:text-telegram-hint",
                        "focus:outline-none focus:ring-2 focus:ring-telegram-button",
                        "transition-all duration-200",
                        error && "border-red-500 focus:ring-red-500",
                        className,
                    )}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-red-500">{error}</p>
                )}
                {hint && !error && (
                    <p className="mt-1 text-sm text-telegram-hint">{hint}</p>
                )}
            </div>
        )
    },
)

Input.displayName = "Input"
