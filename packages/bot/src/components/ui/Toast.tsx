import { useCallback } from "react"
import { createPortal } from "react-dom"

import { cn } from "../../lib/utils.js"
import { useToastStore } from "../../stores/toast.store.js"

import type { Toast as ToastType, ToastType as ToastVariant } from "../../stores/toast.store.js"

const toastStyles: Record<ToastVariant, string> = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
}

const iconMap: Record<ToastVariant, React.ReactNode> = {
    success: (
        <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    ),
    error: (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
            />
        </svg>
    ),
    warning: (
        <svg
            className="w-5 h-5 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
        </svg>
    ),
    info: (
        <svg
            className="w-5 h-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    ),
}

interface ToastItemProps {
    toast: ToastType
    onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps): React.ReactNode {
    const handleDismiss = useCallback((): void => {
        onDismiss(toast.id)
    }, [toast.id, onDismiss])

    return (
        <div
            role="alert"
            className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg",
                "backdrop-blur-sm bg-opacity-95",
                toastStyles[toast.type],
                toast.isExiting ? "animate-toast-out" : "animate-toast-in",
            )}
        >
            <span className="flex-shrink-0">{iconMap[toast.type]}</span>
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
                type="button"
                onClick={handleDismiss}
                className={cn(
                    "flex-shrink-0 p-1 rounded-full transition-colors",
                    "hover:bg-black/5 active:bg-black/10",
                )}
                aria-label="Закрыть уведомление"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>
    )
}

export function ToastContainer(): React.ReactNode {
    const toasts = useToastStore((state) => state.toasts)
    const markAsExiting = useToastStore((state) => state.markAsExiting)
    const removeToast = useToastStore((state) => state.removeToast)

    const handleDismiss = useCallback(
        (id: string): void => {
            markAsExiting(id)
            setTimeout(() => {
                removeToast(id)
            }, 200)
        },
        [markAsExiting, removeToast],
    )

    if (toasts.length === 0) {
        return null
    }

    return createPortal(
        <div
            className={cn(
                "fixed top-0 left-0 right-0 z-50",
                "flex flex-col items-center gap-2 p-4 pt-safe",
                "pointer-events-none",
            )}
        >
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto max-w-sm w-full">
                    <ToastItem toast={toast} onDismiss={handleDismiss} />
                </div>
            ))}
        </div>,
        document.body,
    )
}

// Export hook for easy usage
export function useToast(): {
    success: (message: string, duration?: number) => string
    error: (message: string, duration?: number) => string
    warning: (message: string, duration?: number) => string
    info: (message: string, duration?: number) => string
} {
    const { success, error, warning, info } = useToastStore()
    return { success, error, warning, info }
}
