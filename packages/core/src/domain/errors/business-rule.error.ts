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

    static tooManyItems(max: number): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "TOO_MANY_ITEMS",
            `Order can contain at most ${max} different items`,
            { max },
        )
    }

    static productNotAvailable(productId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PRODUCT_NOT_AVAILABLE",
            `Product "${productId}" is not available`,
            { productId },
        )
    }

    static shopNotActive(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError("SHOP_NOT_ACTIVE", "Shop is not active", {
            businessId,
        })
    }

    static shopClosed(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError("SHOP_CLOSED", "Shop is closed now", { businessId })
    }

    static notAcceptingOrders(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "NOT_ACCEPTING_ORDERS",
            "Shop is not accepting orders now",
            { businessId },
        )
    }

    static minOrderNotReached(minOrder: number, subtotal: number): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "MIN_ORDER_NOT_REACHED",
            `Minimum order is ${minOrder}`,
            { minOrder, subtotal },
        )
    }

    static outsideDeliveryZone(distanceMeters: number): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "OUTSIDE_DELIVERY_ZONE",
            "Address is outside the delivery zone",
            { distanceMeters },
        )
    }

    static phoneRequired(): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PHONE_REQUIRED",
            "Share your phone number before placing an order",
        )
    }

    static orderCannotBeCancelled(orderId: string, status: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "ORDER_CANNOT_BE_CANCELLED",
            "The shop has already accepted this order",
            { orderId, status },
        )
    }

    static shopAlreadyActive(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError("SHOP_ALREADY_ACTIVE", "Shop is already active", {
            businessId,
        })
    }
}
