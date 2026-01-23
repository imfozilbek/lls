import { io } from "socket.io-client"

import type { Socket } from "socket.io-client"

const WS_URL = (import.meta.env["VITE_WS_URL"] as string | undefined) ?? "http://localhost:4001"

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

class WebSocketClient {
    private socket: Socket | null = null
    private isConnected = false

    connect(): void {
        if (this.socket?.connected) {
            return
        }

        this.socket = io(`${WS_URL}/events`, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ["websocket", "polling"],
        })

        this.socket.on("connect", () => {
            this.isConnected = true
            console.warn("[WS] Connected to server")
        })

        this.socket.on("disconnect", (reason) => {
            this.isConnected = false
            console.warn("[WS] Disconnected:", reason)
        })

        this.socket.on("connect_error", (error) => {
            console.error("[WS] Connection error:", error.message)
        })
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
            this.isConnected = false
        }
    }

    getSocket(): Socket | null {
        return this.socket
    }

    isSocketConnected(): boolean {
        return this.isConnected
    }

    // Room management
    joinOrderRoom(orderId: string): void {
        this.socket?.emit(WS_EVENTS.JOIN_ORDER_ROOM, orderId)
    }

    leaveOrderRoom(orderId: string): void {
        this.socket?.emit(WS_EVENTS.LEAVE_ORDER_ROOM, orderId)
    }

    joinBusinessRoom(businessId: string): void {
        this.socket?.emit(WS_EVENTS.JOIN_BUSINESS_ROOM, businessId)
    }

    leaveBusinessRoom(businessId: string): void {
        this.socket?.emit(WS_EVENTS.LEAVE_BUSINESS_ROOM, businessId)
    }

    joinCourierRoom(): void {
        this.socket?.emit(WS_EVENTS.JOIN_COURIER_ROOM)
    }

    leaveCourierRoom(): void {
        this.socket?.emit(WS_EVENTS.LEAVE_COURIER_ROOM)
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
