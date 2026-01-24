import { Button } from "./Button.js"

import type { ReactNode } from "react"

export type ErrorType = "not-found" | "server-error" | "network" | "generic"

interface ErrorScreenProps {
    type?: ErrorType
    title?: string
    message?: string
    onRetry?: () => void
    onBack?: () => void
}

const errorConfigs: Record<ErrorType, { emoji: string; title: string; message: string }> = {
    "not-found": {
        emoji: "🔍",
        title: "Страница не найдена",
        message: "Запрашиваемая страница не существует или была перемещена.",
    },
    "server-error": {
        emoji: "🔧",
        title: "Ошибка сервера",
        message: "Сервер временно недоступен. Мы уже работаем над этим.",
    },
    network: {
        emoji: "📡",
        title: "Нет подключения",
        message: "Проверьте интернет-соединение и попробуйте снова.",
    },
    generic: {
        emoji: "😕",
        title: "Что-то пошло не так",
        message: "Произошла непредвиденная ошибка. Попробуйте позже.",
    },
}

export function ErrorScreen({
    type = "generic",
    title,
    message,
    onRetry,
    onBack,
}: ErrorScreenProps): ReactNode {
    const config = errorConfigs[type]

    return (
        <div className="min-h-screen bg-telegram-bg flex items-center justify-center p-6">
            <div className="text-center max-w-sm w-full">
                {/* Animated emoji */}
                <div className="text-7xl mb-6 animate-bounce">{config.emoji}</div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-telegram-text mb-3">
                    {title ?? config.title}
                </h1>

                {/* Message */}
                <p className="text-telegram-hint text-base mb-8 leading-relaxed">
                    {message ?? config.message}
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    {onRetry && (
                        <Button onClick={onRetry} fullWidth>
                            Попробовать снова
                        </Button>
                    )}
                    {onBack && (
                        <Button onClick={onBack} variant="secondary" fullWidth>
                            Вернуться назад
                        </Button>
                    )}
                    {!onRetry && !onBack && (
                        <Button onClick={() => window.location.reload()} fullWidth>
                            Обновить страницу
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * 404 Not Found screen
 */
export function NotFoundScreen({ onBack }: { onBack?: () => void }): ReactNode {
    const handleBack = (): void => {
        window.history.back()
    }
    const handleRetry = (): void => {
        window.location.reload()
    }
    return <ErrorScreen type="not-found" onBack={onBack ?? handleBack} onRetry={handleRetry} />
}

/**
 * 500 Server Error screen
 */
export function ServerErrorScreen({ onRetry }: { onRetry?: () => void }): ReactNode {
    const handleRetry = (): void => {
        window.location.reload()
    }
    return <ErrorScreen type="server-error" onRetry={onRetry ?? handleRetry} />
}

/**
 * Network Error screen (offline)
 */
export function NetworkErrorScreen({ onRetry }: { onRetry?: () => void }): ReactNode {
    const handleRetry = (): void => {
        window.location.reload()
    }
    return <ErrorScreen type="network" onRetry={onRetry ?? handleRetry} />
}
