import { useCallback } from "react"
import { createPortal } from "react-dom"

import { cn } from "../../lib/utils.js"
import { useToastStore } from "../../stores/toast.store.js"

import type { Toast as ToastType, ToastType as ToastVariant } from "../../stores/toast.store.js"

const toastStyles: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
    success: {
        bg: "bg-green-50",
        border: "border-green-200",
        icon: "text-green-500",
    },
    error: {
        bg: "bg-red-50",
        border: "border-red-200",
        icon: "text-red-500",
    },
    warning: {
        bg: "bg-amber-50",
        border: "border-amber-200",
        icon: "text-amber-500",
    },
    info: {
        bg: "bg-blue-50",
        border: "border-blue-200",
        icon: "text-blue-500",
    },
}

const iconMap: Record<ToastVariant, React.ReactNode> = {
    success: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    ),
    error: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    ),
    warning: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
        </svg>
    ),
    info: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    const styles = toastStyles[toast.type]

    const handleDismiss = useCallback((): void => {
        onDismiss(toast.id)
    }, [toast.id, onDismiss])

    return (
        <div
            role="alert"
            className={cn(
                "flex items-start gap-3 w-96 p-4 rounded-lg border shadow-lg",
                styles.bg,
                styles.border,
                toast.isExiting ? "animate-toast-out" : "animate-toast-in",
            )}
        >
            <span className={cn("flex-shrink-0 mt-0.5", styles.icon)}>{iconMap[toast.type]}</span>
            <div className="flex-1 min-w-0">
                {toast.title && (
                    <h4 className="font-semibold text-gray-900 text-sm">{toast.title}</h4>
                )}
                <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
            </div>
            <button
                type="button"
                onClick={handleDismiss}
                className={cn(
                    "flex-shrink-0 p-1 rounded-md transition-colors",
                    "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
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
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <ToastItem toast={toast} onDismiss={handleDismiss} />
                </div>
            ))}
        </div>,
        document.body,
    )
}

// Export hook for easy usage
export function useToast(): {
    success: (message: string, title?: string) => string
    error: (message: string, title?: string) => string
    warning: (message: string, title?: string) => string
    info: (message: string, title?: string) => string
} {
    const { success, error, warning, info } = useToastStore()
    return { success, error, warning, info }
}
