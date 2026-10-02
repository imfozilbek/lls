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

    static inviteUsed(): BusinessRuleViolationError {
        return new BusinessRuleViolationError("INVITE_USED", "This invite link was already used")
    }

    static inviteExpired(): BusinessRuleViolationError {
        return new BusinessRuleViolationError("INVITE_EXPIRED", "This invite link has expired")
    }

    static orderNotAssignable(orderId: string, status: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "ORDER_NOT_ASSIGNABLE",
            "A courier can be assigned only before the order is picked up",
            { orderId, status },
        )
    }

    /** `reason`: not_approved, day_off, off_today or not_on_shift — the app explains it. */
    static courierNotAvailable(courierId: string, reason: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "COURIER_NOT_AVAILABLE",
            "This courier cannot take an order now",
            { courierId, reason },
        )
    }

    static notInMarketplace(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "NOT_IN_MARKETPLACE",
            "The shop has no marketplace agreement",
            { businessId },
        )
    }

    static paymentNotConfirmable(status: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYMENT_NOT_CONFIRMABLE",
            "Only an unpaid or awaited payment can be confirmed",
            { status },
        )
    }

    static paymentNotRefundable(status: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYMENT_NOT_REFUNDABLE",
            "Only money owed back can be marked as refunded",
            { status },
        )
    }

    static cardTransferUnavailable(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "CARD_TRANSFER_UNAVAILABLE",
            "The shop has no card for transfers",
            { businessId },
        )
    }

    static handoverTooLarge(onHand: number, amount: number): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "HANDOVER_TOO_LARGE",
            "A courier cannot hand over more cash than they hold",
            { onHand, amount },
        )
    }
}
