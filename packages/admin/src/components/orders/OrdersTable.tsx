import { OrderStatus } from "@lls/core"

import { formatMoney, formatDate } from "../../lib/utils.js"
import { OrderStatusBadge } from "../ui/Badge.js"
import { Button } from "../ui/Button.js"
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableEmptyState,
} from "../ui/Table.js"

import type { OrderDTO } from "@lls/core"
import type { ReactNode } from "react"

interface OrdersTableProps {
    orders: OrderDTO[]
    isLoading: boolean
    onUpdateStatus: (orderId: string, status: string) => void
    onViewDetails: (order: OrderDTO) => void
}

// eslint-disable-next-line max-lines-per-function
export function OrdersTable({
    orders,
    isLoading,
    onUpdateStatus,
    onViewDetails,
}: OrdersTableProps): ReactNode {
    const getNextStatus = (currentStatus: string): string | null => {
        const transitions: Record<string, string> = {
            [OrderStatus.PENDING]: OrderStatus.ACCEPTED,
            [OrderStatus.ACCEPTED]: OrderStatus.PREPARING,
            [OrderStatus.PREPARING]: OrderStatus.READY,
        }
        return transitions[currentStatus] || null
    }

    const getNextStatusLabel = (status: string): string => {
        const labels: Record<string, string> = {
            [OrderStatus.ACCEPTED]: "Принять",
            [OrderStatus.PREPARING]: "Готовить",
            [OrderStatus.READY]: "Готов",
        }
        return labels[status] || status
    }

    return (
        <Table>
            <TableHeader>
                <TableRow hoverable={false}>
                    <TableHead>Заказ</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Адрес</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {orders.length === 0 ? (
                    <TableEmptyState
                        icon="📋"
                        title="Нет заказов"
                        description="Заказы появятся здесь"
                    />
                ) : (
                    orders.map((order) => {
                        const nextStatus = getNextStatus(order.status)
                        return (
                            <TableRow key={order.id}>
                                <TableCell>
                                    <button
                                        onClick={(): void => onViewDetails(order)}
                                        className="font-medium text-blue-600 hover:text-blue-800"
                                    >
                                        #{order.id.slice(-6).toUpperCase()}
                                    </button>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {order.items.length} позиций
                                    </p>
                                </TableCell>
                                <TableCell className="text-gray-600">
                                    {formatDate(order.createdAt)}
                                </TableCell>
                                <TableCell>
                                    <p className="text-sm">{order.deliveryAddress.street}</p>
                                    <p className="text-xs text-gray-500">
                                        {order.deliveryAddress.city}
                                    </p>
                                </TableCell>
                                <TableCell className="font-medium">
                                    {formatMoney(order.total.amount, order.total.currency)}
                                </TableCell>
                                <TableCell>
                                    <OrderStatusBadge status={order.status} />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {nextStatus && (
                                            <Button
                                                size="sm"
                                                loading={isLoading}
                                                onClick={(): void =>
                                                    onUpdateStatus(order.id, nextStatus)
                                                }
                                            >
                                                {getNextStatusLabel(nextStatus)}
                                            </Button>
                                        )}
                                        {order.status === OrderStatus.PENDING && (
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                loading={isLoading}
                                                onClick={(): void =>
                                                    onUpdateStatus(order.id, OrderStatus.CANCELLED)
                                                }
                                            >
                                                Отклонить
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })
                )}
            </TableBody>
        </Table>
    )
}
