import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "../components/ui/Button.js"
import { Card } from "../components/ui/Card.js"
import { Input } from "../components/ui/Input.js"
import { useAuthStore } from "../stores/auth.store.js"

import type { ReactNode, FormEvent } from "react"

export function Login(): ReactNode {
    const navigate = useNavigate()
    const login = useAuthStore((state) => state.login)
    const isLoading = useAuthStore((state) => state.isLoading)
    const error = useAuthStore((state) => state.error)

    const [telegramId, setTelegramId] = useState("")
    const [formError, setFormError] = useState("")

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault()
        setFormError("")

        const id = Number(telegramId.trim())
        if (!id || isNaN(id)) {
            setFormError("Введите корректный Telegram ID")
            return
        }

        try {
            await login(id)
            void navigate("/")
        } catch {
            // Error is handled in store
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md" padding="lg">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">LLS Admin</h1>
                    <p className="text-gray-600 mt-1">Вход для бизнеса</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {(error || formError) && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                            {formError || error}
                        </div>
                    )}

                    <Input
                        label="Telegram ID"
                        type="text"
                        placeholder="123456789"
                        value={telegramId}
                        onChange={(e): void => setTelegramId(e.target.value)}
                        hint="Введите Telegram ID вашего бизнеса"
                    />

                    <Button type="submit" fullWidth loading={isLoading}>
                        Войти
                    </Button>
                </form>

                <p className="text-xs text-gray-500 text-center mt-6">
                    Telegram ID можно узнать у @userinfobot
                </p>
            </Card>
        </div>
    )
}
