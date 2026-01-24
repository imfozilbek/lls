import { OrderStatus } from "../enums/order-status.js"

/**
 * Valid order status transitions
 *
 * Cancellation rules:
 * - PENDING: Customer can cancel freely (order not yet accepted)
 * - ACCEPTED: Customer can cancel (business hasn't started preparing)
 * - PREPARING: Cannot cancel (food is being made, resources committed)
 * - READY: Cannot cancel (order is ready for pickup)
 * - PICKED_UP: Cannot cancel (courier is delivering)
 * - DELIVERED/CANCELLED: Terminal states
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
    [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.READY],
    [OrderStatus.READY]: [OrderStatus.PICKED_UP],
    [OrderStatus.PICKED_UP]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Get all valid next statuses for a given status
 */
export function getValidNextStatuses(status: OrderStatus): OrderStatus[] {
    return VALID_TRANSITIONS[status] ?? []
}

/**
 * Check if an order can be cancelled from the current status
 */
export function canBeCancelled(status: OrderStatus): boolean {
    return VALID_TRANSITIONS[status]?.includes(OrderStatus.CANCELLED) ?? false
}

/**
 * Check if an order is in a final state (no more transitions possible)
 */
export function isFinalStatus(status: OrderStatus): boolean {
    return VALID_TRANSITIONS[status]?.length === 0
}

/**
 * Get the status flow for display purposes
 */
export function getStatusFlow(): OrderStatus[] {
    return [
        OrderStatus.PENDING,
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.PICKED_UP,
        OrderStatus.DELIVERED,
    ]
}

/**
 * Get status index in the flow (for progress calculation)
 */
export function getStatusIndex(status: OrderStatus): number {
    if (status === OrderStatus.CANCELLED) {
        return -1
    }
    return getStatusFlow().indexOf(status)
}

/**
 * Calculate order progress as percentage (0-100)
 */
export function calculateProgress(status: OrderStatus): number {
    if (status === OrderStatus.CANCELLED) {
        return 0
    }
    const index = getStatusIndex(status)
    const total = getStatusFlow().length - 1
    return Math.round((index / total) * 100)
}
