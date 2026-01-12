import { cn } from "../../lib/utils.js"

import type { ReactNode, InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps): ReactNode {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-")

    return (
        <div className="space-y-1">
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={cn(
                    "block w-full rounded-lg border px-3 py-2 text-sm transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-offset-0",
                    error
                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200",
                    "disabled:bg-gray-50 disabled:cursor-not-allowed",
                    className,
                )}
                {...props}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
        </div>
    )
}

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
    label?: string
    error?: string
    hint?: string
    rows?: number
}

export function Textarea({
    label,
    error,
    hint,
    className,
    id,
    rows = 3,
    ...props
}: TextareaProps): ReactNode {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-")

    return (
        <div className="space-y-1">
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <textarea
                id={inputId}
                rows={rows}
                className={cn(
                    "block w-full rounded-lg border px-3 py-2 text-sm transition-colors resize-none",
                    "focus:outline-none focus:ring-2 focus:ring-offset-0",
                    error
                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200",
                    "disabled:bg-gray-50 disabled:cursor-not-allowed",
                    className,
                )}
                {...props}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
        </div>
    )
}
