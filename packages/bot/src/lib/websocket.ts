import { io } from "socket.io-client"

import { env } from "./env.js"
import { logger } from "./logger.js"

import type { Socket } from "socket.io-client"

const log = logger.child("ws")

export const WS_EVENTS = {
    // Client → Server
    JOIN_ORDER_ROOM: "join_order_room",
    LEAVE_ORDER_ROOM: "leave_order_room",
    JOIN_BUSINESS_ROOM: "join_business_room",
    LEAVE_BUSINESS_ROOM: "leave_business_room",
    JOIN_COURIER_ROOM: "join_courier_room",
    LEAVE_COURIER_ROOM: "leave_courier_room",

    // Server → Client
    ORDER_CREATED: "order_created",
    ORDER_STATUS_CHANGED: "order_status_changed",
    ORDER_CANCELLED: "order_cancelled",
    COURIER_ASSIGNED: "courier_assigned",
    NEW_ORDER_AVAILABLE: "new_order_available",
} as const

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error"

export interface OrderStatusChangedPayload {
    orderId: string
    previousStatus: string
    newStatus: string
    updatedAt: string
}

export interface OrderCreatedPayload {
    orderId: string
    businessId: string
    customerId: string
    total: { amount: number; currency: string }
    status: string
    createdAt: string
}

export interface CourierAssignedPayload {
    orderId: string
    courierId: string
    courierName: string
    assignedAt: string
}

export interface NewOrderAvailablePayload {
    orderId: string
    businessId: string
    businessName: string
    deliveryAddress: { street: string; city: string }
    total: { amount: number; currency: string }
    createdAt: string
}

type ConnectionStatusListener = (status: ConnectionStatus) => void

class WebSocketClient {
    private socket: Socket | null = null
    private isConnected = false
    private connectionStatusListeners: Set<ConnectionStatusListener> = new Set()
    private reconnectAttempts = 0
    private maxReconnectAttempts = 10

    // Track active subscriptions for auto-rejoin after reconnect
    private activeOrderRooms: Set<string> = new Set()
    private activeBusinessRooms: Set<string> = new Set()
    private isCourierRoomActive = false

    connect(): void {
        if (this.socket?.connected) {
            return
        }

        this.notifyConnectionStatus("connecting")

        this.socket = io(`${env.wsUrl}/events`, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            transports: ["websocket", "polling"],
        })

        this.socket.on("connect", () => {
            this.isConnected = true
            this.reconnectAttempts = 0
            this.notifyConnectionStatus("connected")
            log.info("Connected to server")

            // Auto-rejoin rooms after reconnection
            this.rejoinRooms()
        })

        this.socket.on("disconnect", (reason) => {
            this.isConnected = false
            this.notifyConnectionStatus("disconnected")
            log.info("Disconnected", { reason })
        })

        this.socket.on("connect_error", (error) => {
            this.reconnectAttempts++
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.notifyConnectionStatus("error")
            }
            log.warn("Connection error", { message: error.message })
        })

        this.socket.io.on("reconnect", (attempt) => {
            log.info("Reconnected", { attempt })
            this.notifyConnectionStatus("connected")
        })

        this.socket.io.on("reconnect_attempt", (attempt) => {
            log.info("Reconnect attempt", { attempt })
            this.notifyConnectionStatus("connecting")
        })
    }

    /**
     * Manually trigger reconnection
     */
    reconnect(): void {
        if (this.socket) {
            this.reconnectAttempts = 0
            this.socket.connect()
            this.notifyConnectionStatus("connecting")
        } else {
            this.connect()
        }
    }

    /**
     * Reset error state and try to reconnect
     */
    resetAndReconnect(): void {
        this.reconnectAttempts = 0
        if (this.socket) {
            this.socket.disconnect()
            this.socket.connect()
        } else {
            this.connect()
        }
        this.notifyConnectionStatus("connecting")
    }

    /**
     * Rejoin all active rooms after reconnection
     */
    private rejoinRooms(): void {
        // Rejoin order rooms
        this.activeOrderRooms.forEach((orderId) => {
            this.socket?.emit(WS_EVENTS.JOIN_ORDER_ROOM, orderId)
        })

        // Rejoin business rooms
        this.activeBusinessRooms.forEach((businessId) => {
            this.socket?.emit(WS_EVENTS.JOIN_BUSINESS_ROOM, businessId)
        })

        // Rejoin courier room
        if (this.isCourierRoomActive) {
            this.socket?.emit(WS_EVENTS.JOIN_COURIER_ROOM)
        }

        if (
            this.activeOrderRooms.size > 0 ||
            this.activeBusinessRooms.size > 0 ||
            this.isCourierRoomActive
        ) {
            log.info("Rejoined rooms after reconnect", {
                orders: this.activeOrderRooms.size,
                businesses: this.activeBusinessRooms.size,
                courier: this.isCourierRoomActive,
            })
        }
    }

    private notifyConnectionStatus(status: ConnectionStatus): void {
        this.connectionStatusListeners.forEach((listener) => listener(status))
    }

    onConnectionStatusChange(listener: ConnectionStatusListener): () => void {
        this.connectionStatusListeners.add(listener)
        return () => {
            this.connectionStatusListeners.delete(listener)
        }
    }

    getConnectionStatus(): ConnectionStatus {
        if (!this.socket) {
            return "disconnected"
        }
        if (this.socket.connected) {
            return "connected"
        }
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            return "error"
        }
        return "connecting"
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
            this.isConnected = false
            this.connectionStatusListeners.clear()
        }
    }

    getSocket(): Socket | null {
        return this.socket
    }

    isSocketConnected(): boolean {
        return this.isConnected
    }

    // Room management with tracking for auto-rejoin
    joinOrderRoom(orderId: string): void {
        this.activeOrderRooms.add(orderId)
        this.socket?.emit(WS_EVENTS.JOIN_ORDER_ROOM, orderId)
    }

    leaveOrderRoom(orderId: string): void {
        this.activeOrderRooms.delete(orderId)
        this.socket?.emit(WS_EVENTS.LEAVE_ORDER_ROOM, orderId)
    }

    joinBusinessRoom(businessId: string): void {
        this.activeBusinessRooms.add(businessId)
        this.socket?.emit(WS_EVENTS.JOIN_BUSINESS_ROOM, businessId)
    }

    leaveBusinessRoom(businessId: string): void {
        this.activeBusinessRooms.delete(businessId)
        this.socket?.emit(WS_EVENTS.LEAVE_BUSINESS_ROOM, businessId)
    }

    joinCourierRoom(): void {
        this.isCourierRoomActive = true
        this.socket?.emit(WS_EVENTS.JOIN_COURIER_ROOM)
    }

    leaveCourierRoom(): void {
        this.isCourierRoomActive = false
        this.socket?.emit(WS_EVENTS.LEAVE_COURIER_ROOM)
    }

    /**
     * Clear all room subscriptions
     */
    clearRooms(): void {
        this.activeOrderRooms.clear()
        this.activeBusinessRooms.clear()
        this.isCourierRoomActive = false
    }

    // Event listeners
    onOrderStatusChanged(callback: (payload: OrderStatusChangedPayload) => void): () => void {
        this.socket?.on(WS_EVENTS.ORDER_STATUS_CHANGED, callback)
        return () => {
            this.socket?.off(WS_EVENTS.ORDER_STATUS_CHANGED, callback)
        }
    }

    onOrderCreated(callback: (payload: OrderCreatedPayload) => void): () => void {
        this.socket?.on(WS_EVENTS.ORDER_CREATED, callback)
        return () => {
            this.socket?.off(WS_EVENTS.ORDER_CREATED, callback)
        }
    }

    onOrderCancelled(callback: (payload: OrderStatusChangedPayload) => void): () => void {
        this.socket?.on(WS_EVENTS.ORDER_CANCELLED, callback)
        return () => {
            this.socket?.off(WS_EVENTS.ORDER_CANCELLED, callback)
        }
    }

    onCourierAssigned(callback: (payload: CourierAssignedPayload) => void): () => void {
        this.socket?.on(WS_EVENTS.COURIER_ASSIGNED, callback)
        return () => {
            this.socket?.off(WS_EVENTS.COURIER_ASSIGNED, callback)
        }
    }

    onNewOrderAvailable(callback: (payload: NewOrderAvailablePayload) => void): () => void {
        this.socket?.on(WS_EVENTS.NEW_ORDER_AVAILABLE, callback)
        return () => {
            this.socket?.off(WS_EVENTS.NEW_ORDER_AVAILABLE, callback)
        }
    }
}

export const wsClient = new WebSocketClient()
