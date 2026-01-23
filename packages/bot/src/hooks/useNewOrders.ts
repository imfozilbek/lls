import { useEffect, useCallback } from "react"

import { formatMoney } from "../lib/utils.js"
import { wsClient } from "../lib/websocket.js"
import { useCourierStore } from "../stores/courier.store.js"
import { useToastStore } from "../stores/toast.store.js"

import type { NewOrderAvailablePayload } from "../lib/websocket.js"

/**
 * Hook to subscribe to new order notifications for couriers
 * @param isCourierMode - Whether the user is in courier mode
 */
export function useNewOrders(isCourierMode: boolean): void {
    const { fetchAvailableOrders } = useCourierStore()
    const { addToast } = useToastStore()

    const handleNewOrder = useCallback(
        (payload: NewOrderAvailablePayload): void => {
            // Refresh available orders list
            void fetchAvailableOrders()

            // Show toast notification
            addToast({
                type: "info",
                message: `Новый заказ: ${payload.businessName} — ${formatMoney(payload.total.amount, payload.total.currency)}`,
            })

            // Play notification sound (if available)
            playNotificationSound()
        },
        [fetchAvailableOrders, addToast],
    )

    useEffect(() => {
        if (!isCourierMode) {
            return
        }

        // Connect to WebSocket if not already connected
        wsClient.connect()

        // Join courier room
        wsClient.joinCourierRoom()

        // Subscribe to new order events
        const unsubscribe = wsClient.onNewOrderAvailable(handleNewOrder)

        return (): void => {
            wsClient.leaveCourierRoom()
            unsubscribe()
        }
    }, [isCourierMode, handleNewOrder])
}

function playNotificationSound(): void {
    try {
        // Use Telegram's haptic feedback if available
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred("success")
        }
    } catch {
        // Ignore errors if haptic feedback is not available
    }
}
