/**
 * WebSocket event types for real-time updates
 */

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

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS]

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
