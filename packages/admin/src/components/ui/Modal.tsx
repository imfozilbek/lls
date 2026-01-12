import { useEffect, useCallback } from "react"

import { cn } from "../../lib/utils.js"

import type { ReactNode } from "react"

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: ReactNode
    size?: "sm" | "md" | "lg" | "xl"
    showCloseButton?: boolean
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = "md",
    showCloseButton = true,
}: ModalProps): ReactNode {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                onClose()
            }
        },
        [onClose],
    )

    useEffect(() => {
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown)
            document.body.style.overflow = "hidden"
        }
        return (): void => {
            document.removeEventListener("keydown", handleKeyDown)
            document.body.style.overflow = "unset"
        }
    }, [isOpen, handleKeyDown])

    if (!isOpen) {
        return null
    }

    const sizes = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className={cn(
                        "relative w-full bg-white rounded-xl shadow-xl transform transition-all",
                        sizes[size],
                    )}
                >
                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            {title && (
                                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                            )}
                            {showCloseButton && (
                                <button
                                    onClick={onClose}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <svg
                                        className="w-5 h-5"
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
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div className="px-6 py-4">{children}</div>
                </div>
            </div>
        </div>
    )
}

interface ModalFooterProps {
    children: ReactNode
    className?: string
}

export function ModalFooter({ children, className }: ModalFooterProps): ReactNode {
    return (
        <div
            className={cn(
                "flex items-center justify-end gap-3 pt-4 border-t border-gray-200 mt-4 -mx-6 -mb-4 px-6 pb-4",
                className,
            )}
        >
            {children}
        </div>
    )
}
