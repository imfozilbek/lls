import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { useBackButton } from "../../hooks/useTelegram.js"
import { cn } from "../../lib/utils.js"

interface HeaderProps {
    title: string
    showBack?: boolean
    onBack?: () => void
    rightElement?: ReactNode
    className?: string
}

export function Header({
    title,
    showBack = false,
    onBack,
    rightElement,
    className,
}: HeaderProps): ReactNode {
    const navigate = useNavigate()

    const handleBack = (): void => {
        if (onBack) {
            onBack()
        } else {
            void navigate(-1)
        }
    }

    useBackButton(handleBack, showBack)

    return (
        <header
            className={cn(
                "sticky top-0 z-40 bg-telegram-bg",
                "px-4 py-3 flex items-center justify-between",
                "border-b border-telegram-secondary",
                className,
            )}
        >
            <div className="flex items-center gap-3">
                {showBack && (
                    <button
                        onClick={handleBack}
                        className="p-1 -ml-1 rounded-full hover:bg-telegram-secondary transition-colors"
                    >
                        <svg
                            className="w-6 h-6 text-telegram-text"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                )}
                <h1 className="text-lg font-semibold text-telegram-text">{title}</h1>
            </div>
            {rightElement && <div>{rightElement}</div>}
        </header>
    )
}
