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

/** Who moves an order. Stage 3 may add more actors; the rule stays in this file. */
export type OrderActor = "owner" | "courier" | "customer"

/**
 * The ONLY actor rule, next to the transitions table:
 * the owner makes every step, the assigned courier only the delivery part,
 * the customer only cancels while the order is still pending.
 */
export function canActorMove(actor: OrderActor, from: OrderStatus, to: OrderStatus): boolean {
    if (!canTransitionTo(from, to)) {
        return false
    }
    if (actor === "owner") {
        return true
    }
    if (actor === "courier") {
        return to === OrderStatus.PICKED_UP || to === OrderStatus.DELIVERED
    }
    return to === OrderStatus.CANCELLED && from === OrderStatus.PENDING
}
