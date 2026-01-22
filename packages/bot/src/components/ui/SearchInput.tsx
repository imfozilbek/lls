import { type InputHTMLAttributes, forwardRef, useCallback } from "react"

import { cn } from "../../lib/utils.js"

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
    onClear?: () => void
    isSearching?: boolean
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
    ({ className, value, onChange, onClear, isSearching, ...props }, ref) => {
        const hasValue = typeof value === "string" && value.length > 0

        const handleClear = useCallback((): void => {
            onClear?.()
        }, [onClear])

        return (
            <div className="relative w-full">
                {/* Search Icon */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isSearching ? (
                        <svg
                            className="w-5 h-5 text-telegram-hint animate-spin"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    ) : (
                        <svg
                            className="w-5 h-5 text-telegram-hint"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    )}
                </div>

                <input
                    ref={ref}
                    type="text"
                    value={value}
                    onChange={onChange}
                    className={cn(
                        "w-full pl-10 pr-10 py-2.5 rounded-xl",
                        "bg-telegram-secondary text-telegram-text",
                        "border border-transparent",
                        "placeholder:text-telegram-hint",
                        "focus:outline-none focus:ring-2 focus:ring-telegram-button",
                        "transition-all duration-200",
                        className,
                    )}
                    {...props}
                />

                {/* Clear Button */}
                {hasValue && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2",
                            "p-1 rounded-full",
                            "text-telegram-hint hover:text-telegram-text",
                            "hover:bg-telegram-bg",
                            "transition-colors",
                        )}
                        aria-label="Очистить поиск"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                )}
            </div>
        )
    },
)

SearchInput.displayName = "SearchInput"
