import { useWebSocket } from "../../hooks/useWebSocket.js"

import type { ReactNode } from "react"

/**
 * Connection status indicator that shows when WebSocket is disconnected or reconnecting
 */
export function ConnectionStatus(): ReactNode {
    const { status, isConnected, reconnect } = useWebSocket()

    // Don't show anything when connected
    if (isConnected) {
        return null
    }

    const statusConfig = {
        connecting: {
            bg: "bg-yellow-500",
            text: "Подключение...",
            showRetry: false,
        },
        disconnected: {
            bg: "bg-gray-500",
            text: "Нет соединения",
            showRetry: true,
        },
        error: {
            bg: "bg-red-500",
            text: "Ошибка соединения",
            showRetry: true,
        },
        connected: {
            bg: "bg-green-500",
            text: "Подключено",
            showRetry: false,
        },
    }

    const config = statusConfig[status]

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-50 ${config.bg} text-white py-2 px-4 flex items-center justify-center gap-3 text-sm`}
        >
            <span className="flex items-center gap-2">
                {status === "connecting" && (
                    <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                )}
                {config.text}
            </span>
            {config.showRetry && (
                <button
                    onClick={reconnect}
                    className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-medium transition-colors"
                >
                    Переподключить
                </button>
            )}
        </div>
    )
}
