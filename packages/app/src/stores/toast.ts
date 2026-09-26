import { create } from "zustand"

export interface Toast {
    id: number
    text: string
    tone: "info" | "success" | "error"
}

interface ToastState {
    toasts: Toast[]
    show(text: string, tone?: Toast["tone"]): void
    dismiss(id: number): void
}

const DURATION_MS = 3200
let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
    toasts: [],
    show: (text, tone = "info"): void => {
        const id = nextId++
        // One toast at a time: a new message replaces the old one.
        set({ toasts: [{ id, text, tone }] })
        window.setTimeout(() => get().dismiss(id), DURATION_MS)
    },
    dismiss: (id): void => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export function toast(text: string, tone?: Toast["tone"]): void {
    useToasts.getState().show(text, tone)
}
