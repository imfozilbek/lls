import { BusinessType } from "@lls/core"
import { useState, useEffect } from "react"

import { Layout } from "../components/layout/Layout.js"
import { Button } from "../components/ui/Button.js"
import { Card, CardHeader, CardTitle } from "../components/ui/Card.js"
import { Input } from "../components/ui/Input.js"
import { getBusinessTypeLabel } from "../lib/utils.js"
import { useAuthStore } from "../stores/auth.store.js"

import type { ReactNode, FormEvent } from "react"

// eslint-disable-next-line max-lines-per-function
export function Settings(): ReactNode {
    const business = useAuthStore((state) => state.business)
    const isLoading = useAuthStore((state) => state.isLoading)
    const error = useAuthStore((state) => state.error)
    const updateBusiness = useAuthStore((state) => state.updateBusiness)

    const [name, setName] = useState("")
    const [street, setStreet] = useState("")
    const [city, setCity] = useState("")
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (business) {
            setName(business.name)
            setStreet(business.address.street)
            setCity(business.address.city)
        }
    }, [business])

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault()
        setSuccess(false)

        try {
            await updateBusiness({
                name,
                address: { street, city },
            })
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch {
            // Error handled in store
        }
    }

    return (
        <Layout>
            <div className="space-y-6 max-w-2xl">
                <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>

                {/* Business Info */}
                <Card padding="none">
                    <CardHeader>
                        <CardTitle>Информация о бизнесе</CardTitle>
                    </CardHeader>
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
                                Настройки сохранены
                            </div>
                        )}

                        <Input
                            label="Название"
                            value={name}
                            onChange={(e): void => setName(e.target.value)}
                            required
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Улица"
                                value={street}
                                onChange={(e): void => setStreet(e.target.value)}
                                placeholder="ул. Навои, д. 10"
                                required
                            />
                            <Input
                                label="Город"
                                value={city}
                                onChange={(e): void => setCity(e.target.value)}
                                placeholder="Ташкент"
                                required
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" loading={isLoading}>
                                Сохранить
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Business Type (read-only) */}
                <Card padding="none">
                    <CardHeader>
                        <CardTitle>Тип бизнеса</CardTitle>
                    </CardHeader>
                    <div className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                {business?.type === BusinessType.FOOD && "🍕"}
                                {business?.type === BusinessType.CONSTRUCTION && "🔨"}
                                {business?.type === BusinessType.WATER && "💧"}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">
                                    {business ? getBusinessTypeLabel(business.type) : "—"}
                                </p>
                                <p className="text-sm text-gray-500">Тип бизнеса нельзя изменить</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Telegram ID (read-only) */}
                <Card padding="none">
                    <CardHeader>
                        <CardTitle>Telegram ID</CardTitle>
                    </CardHeader>
                    <div className="p-4">
                        <p className="font-mono text-gray-900">{business?.telegramId || "—"}</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Используется для входа в систему
                        </p>
                    </div>
                </Card>
            </div>
        </Layout>
    )
}
