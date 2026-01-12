import { type ReactNode, useEffect } from "react"

import { Layout } from "../../components/layout/Layout.js"
import { OrderCard } from "../../components/order/OrderCard.js"
import { Skeleton } from "../../components/ui/Loading.js"
import { useAuthStore } from "../../stores/auth.store.js"
import { useOrderStore } from "../../stores/order.store.js"

export function Orders(): ReactNode {
    const customer = useAuthStore((state) => state.customer)
    const orders = useOrderStore((state) => state.orders)
    const isLoading = useOrderStore((state) => state.isLoading)
    const error = useOrderStore((state) => state.error)
    const fetchOrders = useOrderStore((state) => state.fetchOrders)

    useEffect(() => {
        if (customer?.id) {
            void fetchOrders(customer.id)
        }
    }, [customer?.id, fetchOrders])

    return (
        <Layout title="Мои заказы">
            <div className="p-4">
                {error && (
                    <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-xl bg-telegram-secondary">
                                <div className="flex justify-between mb-3">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                                <Skeleton className="h-4 w-32 mb-3" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh]">
                        <div className="text-5xl mb-4">📦</div>
                        <h2 className="text-xl font-semibold text-telegram-text mb-2">
                            Нет заказов
                        </h2>
                        <p className="text-telegram-hint text-center">Ваши заказы появятся здесь</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map((order) => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    )
}
