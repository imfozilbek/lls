import { DomainEvent } from "./domain-event.js"

import type { MoneyDTO } from "../../application/dtos/index.js"

export interface OrderCreatedEventPayload {
    orderId: string
    businessId: string
    customerId: string
    total: MoneyDTO
    itemCount: number
}

export class OrderCreatedEvent extends DomainEvent {
    public readonly payload: OrderCreatedEventPayload

    constructor(payload: OrderCreatedEventPayload) {
        super()
        this.payload = payload
    }

    get eventName(): string {
        return "order.created"
    }
}
