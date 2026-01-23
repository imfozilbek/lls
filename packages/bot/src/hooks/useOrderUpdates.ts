import { useEffect, useCallback } from "react"

import { wsClient } from "../lib/websocket.js"
import { useOrderStore } from "../stores/order.store.js"
import { useToastStore } from "../stores/toast.store.js"

import type { OrderStatusChangedPayload, CourierAssignedPayload } from "../lib/websocket.js"

/**
 * Hook to subscribe to real-time order updates via WebSocket
 * @param orderId - The order ID to subscribe to
 */
export function useOrderUpdates(orderId: string | null): void {
    const { fetchOrder } = useOrderStore()
    const { addToast } = useToastStore()

    const handleStatusChange = useCallback(
        (payload: OrderStatusChangedPayload): void => {
            if (payload.orderId === orderId) {
                void fetchOrder(orderId)
                addToast({
                    type: "info",
                    message: getStatusChangeMessage(payload.newStatus),
                })
            }
        },
        [orderId, fetchOrder, addToast],
    )

    const handleCourierAssigned = useCallback(
        (payload: CourierAssignedPayload): void => {
            if (payload.orderId === orderId) {
                void fetchOrder(orderId)
                addToast({
                    type: "success",
                    message: `Курьер ${payload.courierName} принял ваш заказ`,
                })
            }
        },
        [orderId, fetchOrder, addToast],
    )

    useEffect(() => {
        if (!orderId) {
            return
        }

        // Connect to WebSocket if not already connected
        wsClient.connect()

        // Join order room
        wsClient.joinOrderRoom(orderId)

        // Subscribe to events
        const unsubscribeStatus = wsClient.onOrderStatusChanged(handleStatusChange)
        const unsubscribeCourier = wsClient.onCourierAssigned(handleCourierAssigned)

        return (): void => {
            wsClient.leaveOrderRoom(orderId)
            unsubscribeStatus()
            unsubscribeCourier()
        }
    }, [orderId, handleStatusChange, handleCourierAssigned])
}

function getStatusChangeMessage(status: string): string {
    const messages: Record<string, string> = {
        pending: "Заказ ожидает подтверждения",
        accepted: "Заказ подтверждён",
        preparing: "Заказ готовится",
        ready: "Заказ готов к выдаче",
        picked_up: "Курьер забрал заказ",
        delivered: "Заказ доставлен!",
        cancelled: "Заказ отменён",
    }
    return messages[status] ?? `Статус заказа изменён: ${status}`
}
