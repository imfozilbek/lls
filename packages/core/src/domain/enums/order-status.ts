export enum OrderStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    PREPARING = "preparing",
    READY = "ready",
    PICKED_UP = "picked_up",
    DELIVERED = "delivered",
    CANCELLED = "cancelled",
}

export const ORDER_STATUSES: readonly OrderStatus[] = Object.values(OrderStatus)

/** The ONLY order transitions table in the codebase. */
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
    [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
    [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
    [OrderStatus.READY]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
    [OrderStatus.PICKED_UP]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
}

export function canTransitionTo(from: OrderStatus, to: OrderStatus): boolean {
    return TRANSITIONS[from].includes(to)
}

/** The next forward step (not cancel), or null for final statuses. */
export function getNextStatus(status: OrderStatus): OrderStatus | null {
    return TRANSITIONS[status].find((next) => next !== OrderStatus.CANCELLED) ?? null
}

export function isFinalStatus(status: OrderStatus): boolean {
    return TRANSITIONS[status].length === 0
}

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
    (status) => !isFinalStatus(status),
)
