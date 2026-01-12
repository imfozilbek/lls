import { DomainError } from "./domain-error.js"

import type { OrderStatus } from "../enums/order-status.js"

export class InvalidOrderTransitionError extends DomainError {
    readonly code = "INVALID_ORDER_TRANSITION"

    constructor(
        public readonly orderId: string,
        public readonly fromStatus: OrderStatus,
        public readonly toStatus: OrderStatus,
    ) {
        super(
            `Cannot transition order "${orderId}" from "${fromStatus}" to "${toStatus}"`,
            { orderId, fromStatus, toStatus },
        )
    }
}
