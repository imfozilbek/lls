import { DomainError } from "./domain-error.js"

export class BusinessRuleViolationError extends DomainError {
    readonly code = "BUSINESS_RULE_VIOLATION"

    constructor(
        public readonly rule: string,
        message: string,
        details?: Record<string, unknown>,
    ) {
        super(message, { rule, ...details })
    }

    static orderAlreadyHasCourier(orderId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "ORDER_ALREADY_HAS_COURIER",
            `Order "${orderId}" already has an assigned courier`,
            { orderId },
        )
    }

    static courierNotAvailable(courierId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "COURIER_NOT_AVAILABLE",
            `Courier "${courierId}" is not available to take orders`,
            { courierId },
        )
    }

    static orderRequiresCourier(orderId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "ORDER_REQUIRES_COURIER",
            `Order "${orderId}" requires a courier to be assigned before pickup`,
            { orderId },
        )
    }

    static emptyOrder(): BusinessRuleViolationError {
        return new BusinessRuleViolationError("EMPTY_ORDER", "Order must contain at least one item")
    }

    static productNotAvailable(productId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PRODUCT_NOT_AVAILABLE",
            `Product "${productId}" is not available`,
            { productId },
        )
    }

    static businessNotActive(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "BUSINESS_NOT_ACTIVE",
            `Business "${businessId}" is not active`,
            { businessId },
        )
    }
}
