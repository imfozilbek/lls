import { useCallback, useEffect, useState } from "react"

import { wsClient } from "../lib/websocket.js"

import type { ConnectionStatus } from "../lib/websocket.js"

interface UseWebSocketResult {
    status: ConnectionStatus
    isConnected: boolean
    isConnecting: boolean
    isDisconnected: boolean
    hasError: boolean
    reconnect: () => void
}

/**
 * Hook to monitor WebSocket connection status and provide reconnection
 */
export function useWebSocket(): UseWebSocketResult {
    const [status, setStatus] = useState<ConnectionStatus>(wsClient.getConnectionStatus())

    useEffect((): (() => void) => {
        // Subscribe to status changes
        const unsubscribe = wsClient.onConnectionStatusChange((newStatus) => {
            setStatus(newStatus)
        })

        // Initial connection if not already connected
        if (wsClient.getConnectionStatus() === "disconnected") {
            wsClient.connect()
        }

        return (): void => {
            unsubscribe()
        }
    }, [])

    const reconnect = useCallback((): void => {
        wsClient.resetAndReconnect()
    }, [])

    return {
        status,
        isConnected: status === "connected",
        isConnecting: status === "connecting",
        isDisconnected: status === "disconnected",
        hasError: status === "error",
        reconnect,
    }
}
