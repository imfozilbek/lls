import { OrderStatus } from "@lls/core"
import { useEffect, useState } from "react"

import { Layout } from "../components/layout/Layout.js"
import { OrdersTable } from "../components/orders/OrdersTable.js"
import { OrderStatusBadge } from "../components/ui/Badge.js"
import { Button } from "../components/ui/Button.js"
import { Card } from "../components/ui/Card.js"
import { TableSkeleton } from "../components/ui/Loading.js"
import { Modal, ModalFooter } from "../components/ui/Modal.js"
import { Pagination } from "../components/ui/Pagination.js"
import { useToast } from "../components/ui/Toast.js"
import { formatDate, formatMoney } from "../lib/utils.js"
import { useAuthStore } from "../stores/auth.store.js"
import { useOrdersStore } from "../stores/orders.store.js"

import type { OrderDTO } from "@lls/core"
import type { ReactNode } from "react"

const statusFilters = [
    { value: null, label: "Все" },
    { value: OrderStatus.PENDING, label: "Ожидают" },
    { value: OrderStatus.ACCEPTED, label: "Приняты" },
    { value: OrderStatus.PREPARING, label: "Готовятся" },
    { value: OrderStatus.READY, label: "Готовы" },
    { value: OrderStatus.DELIVERED, label: "Доставлены" },
    { value: OrderStatus.CANCELLED, label: "Отменены" },
]

// eslint-disable-next-line max-lines-per-function
export function Orders(): ReactNode {
    const toast = useToast()
    const business = useAuthStore((state) => state.business)
    const orders = useOrdersStore((state) => state.orders)
    const pagination = useOrdersStore((state) => state.pagination)
    const currentPage = useOrdersStore((state) => state.currentPage)
    const isLoading = useOrdersStore((state) => state.isLoading)
    const statusFilter = useOrdersStore((state) => state.statusFilter)
    const fetchOrders = useOrdersStore((state) => state.fetchOrders)
    const setStatusFilter = useOrdersStore((state) => state.setStatusFilter)
    const setPage = useOrdersStore((state) => state.setPage)
    const updateOrderStatus = useOrdersStore((state) => state.updateOrderStatus)

    const [selectedOrder, setSelectedOrder] = useState<OrderDTO | null>(null)

    useEffect(() => {
        if (business) {
            void fetchOrders(business.id)
        }
    }, [business, fetchOrders, statusFilter])

    const getStatusLabel = (status: string): string => {
        const labels: Record<string, string> = {
            [OrderStatus.PENDING]: "Ожидает",
            [OrderStatus.ACCEPTED]: "Принят",
            [OrderStatus.PREPARING]: "Готовится",
            [OrderStatus.READY]: "Готов к выдаче",
            [OrderStatus.PICKED_UP]: "В пути",
            [OrderStatus.DELIVERED]: "Доставлен",
            [OrderStatus.CANCELLED]: "Отменён",
        }
        return labels[status] || status
    }

    const handleStatusChange = async (orderId: string, status: string): Promise<void> => {
        try {
            await updateOrderStatus(orderId, status)
            const statusLabel = getStatusLabel(status)
            toast.success(`Статус заказа изменён на "${statusLabel}"`)
        } catch {
            toast.error("Не удалось изменить статус заказа")
        }
    }

    const handleFilterChange = (status: string | null): void => {
        setStatusFilter(status)
    }

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Заказы</h1>
                    <Button
                        variant="secondary"
                        onClick={(): void => {
                            if (business) {
                                void fetchOrders(business.id)
                            }
                        }}
                        disabled={isLoading}
                    >
                        Обновить
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.value || "all"}
                            onClick={(): void => handleFilterChange(filter.value)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                statusFilter === filter.value
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {/* Orders Table */}
                <Card padding="none">
                    {isLoading && orders.length === 0 ? (
                        <div className="p-4">
                            <TableSkeleton rows={5} cols={6} />
                        </div>
                    ) : (
                        <>
                            <OrdersTable
                                orders={orders}
                                isLoading={isLoading}
                                onUpdateStatus={handleStatusChange}
                                onViewDetails={setSelectedOrder}
                            />
                            {pagination && (
                                <Pagination
                                    page={currentPage}
                                    totalPages={pagination.totalPages}
                                    hasNext={pagination.hasNext}
                                    hasPrev={pagination.hasPrev}
                                    isLoading={isLoading}
                                    onPageChange={(page): void => {
                                        setPage(page)
                                        if (business) {
                                            void fetchOrders(business.id, page)
                                        }
                                    }}
                                />
                            )}
                        </>
                    )}
                </Card>
            </div>

            {/* Order Details Modal */}
            <Modal
                isOpen={selectedOrder !== null}
                onClose={(): void => setSelectedOrder(null)}
                title={`Заказ #${selectedOrder?.id.slice(-6).toUpperCase()}`}
                size="lg"
            >
                {selectedOrder && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Статус</span>
                            <OrderStatusBadge status={selectedOrder.status} />
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Дата</span>
                            <span className="text-sm">{formatDate(selectedOrder.createdAt)}</span>
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-medium text-gray-900 mb-2">Адрес доставки</h4>
                            <p className="text-sm text-gray-600">
                                {selectedOrder.deliveryAddress.street},{" "}
                                {selectedOrder.deliveryAddress.city}
                            </p>
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-medium text-gray-900 mb-2">Состав заказа</h4>
                            <div className="space-y-2">
                                {selectedOrder.items.map((item, index) => (
                                    <div key={index} className="flex justify-between text-sm">
                                        <span>
                                            {item.productName} × {item.quantity}
                                        </span>
                                        <span className="text-gray-600">
                                            {formatMoney(
                                                item.unitPrice.amount * item.quantity,
                                                item.unitPrice.currency,
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t pt-4 flex justify-between font-medium">
                            <span>Итого</span>
                            <span>
                                {formatMoney(
                                    selectedOrder.total.amount,
                                    selectedOrder.total.currency,
                                )}
                            </span>
                        </div>

                        <ModalFooter>
                            <Button
                                variant="secondary"
                                onClick={(): void => setSelectedOrder(null)}
                            >
                                Закрыть
                            </Button>
                        </ModalFooter>
                    </div>
                )}
            </Modal>
        </Layout>
    )
}
