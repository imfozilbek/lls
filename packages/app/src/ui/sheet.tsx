import { useEffect } from "react"
import { createPortal } from "react-dom"

import { useBackButton, useSuspendMainAction } from "../lib/main-button.js"

import type { ReactNode } from "react"

/**
 * A bottom sheet for one small choice (a courier, a reason, "today or for good").
 * Closes by tapping outside, by Telegram's back button or by Escape.
 * Rendered into <body>: inside an animated list row, `position: fixed` would follow the row's
 * transform instead of the screen.
 */
export function Sheet({
    title,
    onClose,
    children,
}: {
    title: string
    onClose(): void
    children: ReactNode
}): React.JSX.Element {
    useBackButton(onClose)
    // The screen's big button belongs under the sheet: tapping it there (the receipt's
    // «O'tkazdim», the cart's «Savat») would act behind the person's back. The sheet's own
    // buttons do the work while it is open.
    useSuspendMainAction()
    useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                onClose()
            }
        }
        window.addEventListener("keydown", onKey)
        return (): void => window.removeEventListener("keydown", onKey)
    }, [onClose])
    return createPortal(
        <div
            className="fixed inset-0 z-sheet flex flex-col justify-end"
            role="dialog"
            aria-modal
            aria-label={title}
        >
            <button
                type="button"
                aria-label={title}
                onClick={onClose}
                className="absolute inset-0 animate-fade-in bg-black/40"
            />
            <div className="pb-safe relative animate-sheet-in rounded-t-[1.5rem] bg-tg-bg px-4 pt-3 shadow-2xl">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-tg-hint/30" aria-hidden />
                <h2 className="mb-3 text-lg font-bold">{title}</h2>
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pb-2">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    )
}

export function SheetOption({
    label,
    hint,
    onClick,
    danger = false,
    disabled = false,
}: {
    label: string
    hint?: string
    onClick(): void
    danger?: boolean
    /** Shown but not pickable, e.g. a courier who is not on shift; the hint says why. */
    disabled?: boolean
}): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="tap flex min-h-[52px] flex-col justify-center rounded-control bg-tg-secondary px-4 py-2.5 text-left disabled:opacity-50 disabled:active:scale-100"
        >
            <span className={danger ? "font-semibold text-tg-destructive" : "font-semibold"}>
                {label}
            </span>
            {hint ? <span className="text-sm text-tg-hint">{hint}</span> : null}
        </button>
    )
}
