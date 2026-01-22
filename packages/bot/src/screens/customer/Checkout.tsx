import { type ReactNode, useState } from "react"
import { useNavigate } from "react-router-dom"

import { CartSummary } from "../../components/cart/CartSummary.js"
import { Layout } from "../../components/layout/Layout.js"
import { Button } from "../../components/ui/Button.js"
import { Input } from "../../components/ui/Input.js"
import { useToast } from "../../components/ui/Toast.js"
import { useCart } from "../../hooks/useCart.js"
import { hapticNotification } from "../../lib/telegram.js"
import { useAuthStore } from "../../stores/auth.store.js"
import { useOrderStore } from "../../stores/order.store.js"

// eslint-disable-next-line max-lines-per-function
export function Checkout(): ReactNode {
    const navigate = useNavigate()
    const toast = useToast()
    const { businessId, isEmpty } = useCart()
    const customer = useAuthStore((state) => state.customer)
    const createOrder = useOrderStore((state) => state.createOrder)
    const isLoading = useOrderStore((state) => state.isLoading)
    const error = useOrderStore((state) => state.error)

    const [street, setStreet] = useState(customer?.address?.street || "")
    const [city, setCity] = useState(customer?.address?.city || "Ташкент")
    const [phone, setPhone] = useState(customer?.phone || "")

    const [formErrors, setFormErrors] = useState<{
        street?: string
        city?: string
        phone?: string
    }>({})

    if (isEmpty) {
        void navigate("/cart")
        return null
    }

    const validate = (): boolean => {
        const errors: typeof formErrors = {}

        if (!street.trim()) {
            errors.street = "Введите адрес доставки"
        }
        if (!city.trim()) {
            errors.city = "Введите город"
        }
        if (!phone.trim()) {
            errors.phone = "Введите номер телефона"
        } else if (!/^\+?[\d\s-]{9,}$/.test(phone)) {
            errors.phone = "Неверный формат телефона"
        }

        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleSubmit = async (): Promise<void> => {
        if (!validate() || !customer || !businessId) {
            return
        }

        try {
            const order = await createOrder({
                customerId: customer.id,
                businessId,
                deliveryAddress: { street, city },
            })

            hapticNotification("success")
            toast.success("Заказ успешно создан!")
            void navigate(`/order/${order.id}`)
        } catch {
            hapticNotification("error")
            toast.error("Не удалось создать заказ. Попробуйте снова.")
        }
    }

    return (
        <Layout title="Оформление" showBack showNav={false}>
            <div className="p-4 pb-32">
                {error && (
                    <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Contact Info */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-telegram-text mb-3">
                        Контактные данные
                    </h2>
                    <div className="space-y-3">
                        <Input
                            label="Телефон"
                            type="tel"
                            placeholder="+998 90 123 45 67"
                            value={phone}
                            onChange={(e): void => setPhone(e.target.value)}
                            error={formErrors.phone}
                        />
                    </div>
                </div>

                {/* Delivery Address */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-telegram-text mb-3">
                        Адрес доставки
                    </h2>
                    <div className="space-y-3">
                        <Input
                            label="Город"
                            placeholder="Ташкент"
                            value={city}
                            onChange={(e): void => setCity(e.target.value)}
                            error={formErrors.city}
                        />
                        <Input
                            label="Улица и дом"
                            placeholder="ул. Навои, д. 10, кв. 5"
                            value={street}
                            onChange={(e): void => setStreet(e.target.value)}
                            error={formErrors.street}
                        />
                    </div>
                </div>

                {/* Order Summary */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-telegram-text mb-3">Ваш заказ</h2>
                    <CartSummary />
                </div>
            </div>

            {/* Submit Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-telegram-bg border-t border-telegram-secondary safe-area-pb">
                <Button fullWidth size="lg" loading={isLoading} onClick={handleSubmit}>
                    Подтвердить заказ
                </Button>
            </div>
        </Layout>
    )
}
