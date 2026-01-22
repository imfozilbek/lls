import { create } from "zustand"

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
    isExiting?: boolean
}

interface ToastState {
    toasts: Toast[]
}

interface ToastActions {
    addToast: (toast: Omit<Toast, "id">) => string
    removeToast: (id: string) => void
    markAsExiting: (id: string) => void
    success: (message: string, duration?: number) => string
    error: (message: string, duration?: number) => string
    warning: (message: string, duration?: number) => string
    info: (message: string, duration?: number) => string
}

type ToastStore = ToastState & ToastActions

const generateId = (): string => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const useToastStore = create<ToastStore>()((set, get) => ({
    toasts: [],

    addToast: (toast): string => {
        const id = generateId()
        const newToast: Toast = {
            id,
            duration: 3000,
            ...toast,
        }

        set((state) => ({
            toasts: [...state.toasts, newToast],
        }))

        // Auto-remove after duration
        if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
                get().markAsExiting(id)
                // Wait for exit animation then remove
                setTimeout(() => {
                    get().removeToast(id)
                }, 200)
            }, newToast.duration)
        }

        return id
    },

    removeToast: (id): void => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }))
    },

    markAsExiting: (id): void => {
        set((state) => ({
            toasts: state.toasts.map((t) => (t.id === id ? { ...t, isExiting: true } : t)),
        }))
    },

    success: (message, duration): string => {
        return get().addToast({ type: "success", message, duration })
    },

    error: (message, duration): string => {
        return get().addToast({ type: "error", message, duration: duration ?? 5000 })
    },

    warning: (message, duration): string => {
        return get().addToast({ type: "warning", message, duration })
    },

    info: (message, duration): string => {
        return get().addToast({ type: "info", message, duration })
    },
}))
