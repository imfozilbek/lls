import { type ReactNode } from "react"

import { cn } from "../../lib/utils.js"

type LoadingSize = "sm" | "md" | "lg"

interface LoadingProps {
    size?: LoadingSize
    fullScreen?: boolean
    className?: string
    text?: string
}

const sizeStyles: Record<LoadingSize, string> = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
}

export function Loading({
    size = "md",
    fullScreen = false,
    className,
    text,
}: LoadingProps): ReactNode {
    const spinner = (
        <div className={cn("flex flex-col items-center gap-3", className)}>
            <svg
                className={cn("animate-spin text-telegram-button", sizeStyles[size])}
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
            {text && <p className="text-sm text-telegram-hint">{text}</p>}
        </div>
    )

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-telegram-bg">
                {spinner}
            </div>
        )
    }

    return spinner
}

interface LoadingSkeletonProps {
    className?: string
}

export function Skeleton({ className }: LoadingSkeletonProps): ReactNode {
    return <div className={cn("animate-pulse bg-telegram-secondary rounded", className)} />
}
