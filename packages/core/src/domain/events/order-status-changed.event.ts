import { DomainEvent } from "./domain-event.js"

import type { OrderStatus } from "../enums/order-status.js"

export interface OrderStatusChangedEventPayload {
    orderId: string
    businessId: string
    previousStatus: OrderStatus
    newStatus: OrderStatus
}

export class OrderStatusChangedEvent extends DomainEvent {
    public readonly payload: OrderStatusChangedEventPayload

    constructor(payload: OrderStatusChangedEventPayload) {
        super()
        this.payload = payload
    }

    get eventName(): string {
        return "order.status_changed"
    }
}
