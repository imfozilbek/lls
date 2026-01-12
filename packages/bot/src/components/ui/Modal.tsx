import { type ReactNode, useEffect } from "react"

import { cn } from "../../lib/utils.js"

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: ReactNode
    className?: string
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    className,
}: ModalProps): ReactNode {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }

        return (): void => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    useEffect(() => {
        function handleEscape(e: KeyboardEvent): void {
            if (e.key === "Escape") {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener("keydown", handleEscape)
            return (): void => {
                document.removeEventListener("keydown", handleEscape)
            }
        }
        return undefined
    }, [isOpen, onClose])

    if (!isOpen) {
        return null
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 animate-fade-in"
                onClick={onClose}
            />

            {/* Modal content */}
            <div
                className={cn(
                    "relative w-full sm:max-w-md",
                    "bg-telegram-bg rounded-t-2xl sm:rounded-2xl",
                    "animate-slide-up",
                    "max-h-[90vh] overflow-y-auto",
                    className,
                )}
            >
                {title && (
                    <div className="sticky top-0 bg-telegram-bg px-4 py-3 border-b border-telegram-secondary">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-telegram-text">
                                {title}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-1 rounded-full hover:bg-telegram-secondary transition-colors"
                            >
                                <svg
                                    className="w-6 h-6 text-telegram-hint"
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
                        </div>
                    </div>
                )}
                <div className="p-4">{children}</div>
            </div>
        </div>
    )
}
