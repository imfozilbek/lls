export enum OrderStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    PREPARING = "preparing",
    READY = "ready",
    PICKED_UP = "picked_up",
    DELIVERED = "delivered",
    CANCELLED = "cancelled",
}

export function canTransitionTo(from: OrderStatus, to: OrderStatus): boolean {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
        [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
        [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
        [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
        [OrderStatus.READY]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
        [OrderStatus.PICKED_UP]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERED]: [],
        [OrderStatus.CANCELLED]: [],
    }

    return transitions[from].includes(to)
}
