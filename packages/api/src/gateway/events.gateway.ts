import { Logger } from "@nestjs/common"
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets"

import { configuration } from "../config/configuration.js"

import { WS_EVENTS } from "./events.types.js"

import type {
    CourierAssignedPayload,
    NewOrderAvailablePayload,
    OrderCreatedPayload,
    OrderStatusChangedPayload,
} from "./events.types.js"
import type { Server, Socket } from "socket.io"

const config = configuration()

@WebSocketGateway({
    cors: {
        // Security: Use specific origins, not wildcard with credentials
        origin: config.nodeEnv === "development" ? true : config.corsOrigins,
        credentials: true,
    },
    namespace: "/events",
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server

    private readonly logger = new Logger(EventsGateway.name)

    afterInit(): void {
        this.logger.log("WebSocket Gateway initialized")
    }

    handleConnection(client: Socket): void {
        this.logger.log(`Client connected: ${client.id}`)
    }

    handleDisconnect(client: Socket): void {
        this.logger.log(`Client disconnected: ${client.id}`)
    }

    // -------------------- Room Management --------------------

    @SubscribeMessage(WS_EVENTS.JOIN_ORDER_ROOM)
    handleJoinOrderRoom(client: Socket, orderId: string): { success: boolean; room: string } {
        const room = `order:${orderId}`
        void client.join(room)
        this.logger.log(`Client ${client.id} joined room: ${room}`)
        return { success: true, room }
    }

    @SubscribeMessage(WS_EVENTS.LEAVE_ORDER_ROOM)
    handleLeaveOrderRoom(client: Socket, orderId: string): { success: boolean; room: string } {
        const room = `order:${orderId}`
        void client.leave(room)
        this.logger.log(`Client ${client.id} left room: ${room}`)
        return { success: true, room }
    }

    @SubscribeMessage(WS_EVENTS.JOIN_BUSINESS_ROOM)
    handleJoinBusinessRoom(client: Socket, businessId: string): { success: boolean; room: string } {
        const room = `business:${businessId}`
        void client.join(room)
        this.logger.log(`Client ${client.id} joined room: ${room}`)
        return { success: true, room }
    }

    @SubscribeMessage(WS_EVENTS.LEAVE_BUSINESS_ROOM)
    handleLeaveBusinessRoom(
        client: Socket,
        businessId: string,
    ): { success: boolean; room: string } {
        const room = `business:${businessId}`
        void client.leave(room)
        this.logger.log(`Client ${client.id} left room: ${room}`)
        return { success: true, room }
    }

    @SubscribeMessage(WS_EVENTS.JOIN_COURIER_ROOM)
    handleJoinCourierRoom(client: Socket): { success: boolean; room: string } {
        const room = "couriers"
        void client.join(room)
        this.logger.log(`Client ${client.id} joined room: ${room}`)
        return { success: true, room }
    }

    @SubscribeMessage(WS_EVENTS.LEAVE_COURIER_ROOM)
    handleLeaveCourierRoom(client: Socket): { success: boolean; room: string } {
        const room = "couriers"
        void client.leave(room)
        this.logger.log(`Client ${client.id} left room: ${room}`)
        return { success: true, room }
    }

    // -------------------- Event Emitters (called by services) --------------------

    /**
     * Emit order status changed event to order room and business room
     */
    emitOrderStatusChanged(
        orderId: string,
        businessId: string,
        payload: OrderStatusChangedPayload,
    ): void {
        const orderRoom = `order:${orderId}`
        const businessRoom = `business:${businessId}`

        this.server.to(orderRoom).emit(WS_EVENTS.ORDER_STATUS_CHANGED, payload)
        this.server.to(businessRoom).emit(WS_EVENTS.ORDER_STATUS_CHANGED, payload)

        this.logger.log(`Emitted order_status_changed for order ${orderId}`)
    }

    /**
     * Emit new order created event to business room
     */
    emitOrderCreated(businessId: string, payload: OrderCreatedPayload): void {
        const businessRoom = `business:${businessId}`

        this.server.to(businessRoom).emit(WS_EVENTS.ORDER_CREATED, payload)

        this.logger.log(`Emitted order_created for business ${businessId}`)
    }

    /**
     * Emit order cancelled event to order room and business room
     */
    emitOrderCancelled(
        orderId: string,
        businessId: string,
        payload: OrderStatusChangedPayload,
    ): void {
        const orderRoom = `order:${orderId}`
        const businessRoom = `business:${businessId}`

        this.server.to(orderRoom).emit(WS_EVENTS.ORDER_CANCELLED, payload)
        this.server.to(businessRoom).emit(WS_EVENTS.ORDER_CANCELLED, payload)

        this.logger.log(`Emitted order_cancelled for order ${orderId}`)
    }

    /**
     * Emit courier assigned event to order room
     */
    emitCourierAssigned(orderId: string, payload: CourierAssignedPayload): void {
        const orderRoom = `order:${orderId}`

        this.server.to(orderRoom).emit(WS_EVENTS.COURIER_ASSIGNED, payload)

        this.logger.log(`Emitted courier_assigned for order ${orderId}`)
    }

    /**
     * Emit new order available event to all couriers
     */
    emitNewOrderAvailable(payload: NewOrderAvailablePayload): void {
        this.server.to("couriers").emit(WS_EVENTS.NEW_ORDER_AVAILABLE, payload)

        this.logger.log(`Emitted new_order_available to couriers`)
    }
}
