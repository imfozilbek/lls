import { DomainEvent } from "./domain-event.js"

export interface CourierAssignedEventPayload {
    orderId: string
    businessId: string
    courierId: string
    courierName: string
}

export class CourierAssignedEvent extends DomainEvent {
    public readonly payload: CourierAssignedEventPayload

    constructor(payload: CourierAssignedEventPayload) {
        super()
        this.payload = payload
    }

    get eventName(): string {
        return "order.courier_assigned"
    }
}
