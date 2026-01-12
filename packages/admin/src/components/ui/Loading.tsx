import { cn } from "../../lib/utils.js"

import type { ReactNode, HTMLAttributes } from "react"

interface LoadingProps {
    size?: "sm" | "md" | "lg"
    className?: string
}

export function Loading({ size = "md", className }: LoadingProps): ReactNode {
    const sizes = {
        sm: "h-4 w-4",
        md: "h-8 w-8",
        lg: "h-12 w-12",
    }

    return (
        <svg
            className={cn("animate-spin text-blue-600", sizes[size], className)}
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    )
}

interface FullScreenLoadingProps {
    text?: string
}

export function FullScreenLoading({ text }: FullScreenLoadingProps): ReactNode {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Loading size="lg" />
            {text && <p className="mt-4 text-gray-600">{text}</p>}
        </div>
    )
}

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
    className?: string
}

export function Skeleton({ className, ...props }: SkeletonProps): ReactNode {
    return <div className={cn("animate-pulse bg-gray-200 rounded", className)} {...props} />
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }): ReactNode {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex gap-4 pb-2 border-b">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-24" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4 py-2">
                    {Array.from({ length: cols }).map((_, colIndex) => (
                        <Skeleton key={colIndex} className="h-4 w-20" />
                    ))}
                </div>
            ))}
        </div>
    )
}
