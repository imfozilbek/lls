import { create } from "zustand"

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
    id: string
    type: ToastType
    title?: string
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
    success: (message: string, title?: string) => string
    error: (message: string, title?: string) => string
    warning: (message: string, title?: string) => string
    info: (message: string, title?: string) => string
}

type ToastStore = ToastState & ToastActions

const generateId = (): string => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const useToastStore = create<ToastStore>()((set, get) => ({
    toasts: [],

    addToast: (toast): string => {
        const id = generateId()
        const newToast: Toast = {
            id,
            duration: toast.type === "error" ? 5000 : 4000,
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

    success: (message, title): string => {
        return get().addToast({ type: "success", message, title: title ?? "Успешно" })
    },

    error: (message, title): string => {
        return get().addToast({ type: "error", message, title: title ?? "Ошибка" })
    },

    warning: (message, title): string => {
        return get().addToast({ type: "warning", message, title: title ?? "Внимание" })
    },

    info: (message, title): string => {
        return get().addToast({ type: "info", message, title: title ?? "Информация" })
    },
}))
