import { useCallback } from "react"
import { useNavigate } from "react-router-dom"

import { TelegramLoginButton } from "../components/auth/TelegramLoginButton.js"
import { Card } from "../components/ui/Card.js"
import { Loading } from "../components/ui/Loading.js"
import { useAuthStore } from "../stores/auth.store.js"

import type { TelegramLoginData } from "../lib/api-client.js"
import type { ReactNode } from "react"

const BOT_NAME = (import.meta.env["VITE_TELEGRAM_BOT_NAME"] as string | undefined) || "llsbot"

export function Login(): ReactNode {
    const navigate = useNavigate()
    const loginWithTelegram = useAuthStore((state) => state.loginWithTelegram)
    const isLoading = useAuthStore((state) => state.isLoading)
    const error = useAuthStore((state) => state.error)

    const handleTelegramAuth = useCallback(
        async (user: TelegramLoginData): Promise<void> => {
            try {
                await loginWithTelegram(user)
                void navigate("/")
            } catch {
                // Error is handled in store
            }
        },
        [loginWithTelegram, navigate],
    )

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md" padding="lg">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">LLS Admin</h1>
                    <p className="text-gray-600 mt-1">Вход для бизнеса</p>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-4">
                        <Loading size="lg" />
                    </div>
                ) : (
                    <TelegramLoginButton
                        botName={BOT_NAME}
                        onAuth={handleTelegramAuth}
                        buttonSize="large"
                        cornerRadius={8}
                    />
                )}

                <p className="text-xs text-gray-500 text-center mt-6">
                    Войдите через Telegram для доступа к панели управления
                </p>
            </Card>
        </div>
    )
}
