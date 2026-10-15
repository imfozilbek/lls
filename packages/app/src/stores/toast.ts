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
/**
 * An error is often the only word on why something did not happen: it stays long enough for a
 * slow reader, and longer for a longer sentence.
 */
const ERROR_MS = 6000
const MS_PER_CHAR = 40
const SHORT_CHARS = 40
let nextId = 1

/** How long a toast stays on screen. */
export function toastDuration(text: string, tone: Toast["tone"]): number {
    if (tone !== "error") {
        return DURATION_MS
    }
    return ERROR_MS + Math.max(0, text.length - SHORT_CHARS) * MS_PER_CHAR
}

export const useToasts = create<ToastState>((set, get) => ({
    toasts: [],
    show: (text, tone = "info"): void => {
        const id = nextId++
        // One toast at a time: a new message replaces the old one.
        set({ toasts: [{ id, text, tone }] })
        window.setTimeout(() => get().dismiss(id), toastDuration(text, tone))
    },
    dismiss: (id): void => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export function toast(text: string, tone?: Toast["tone"]): void {
    useToasts.getState().show(text, tone)
}
