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
