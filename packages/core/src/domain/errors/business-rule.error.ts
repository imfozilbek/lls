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

    /** The product comes in variants (sizes, kinds): the customer must pick one. */
    static variantRequired(productId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError("VARIANT_REQUIRED", "Pick one of the variants", {
            productId,
        })
    }

    /** A variant or an add-on the product no longer has (the owner changed it). */
    static optionUnavailable(productId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "OPTION_UNAVAILABLE",
            `An option of product "${productId}" is not available`,
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

    static outsideDeliveryZone(
        distanceMeters: number,
        radiusMeters: number,
    ): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "OUTSIDE_DELIVERY_ZONE",
            "Address is outside the delivery zone",
            { distanceMeters, radiusMeters },
        )
    }

    /** The shop delivers only so far: without the customer's pin nobody can tell. */
    static locationRequired(radiusMeters: number): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "LOCATION_REQUIRED",
            "Share the delivery location: the shop delivers within a radius",
            { radiusMeters },
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

    /** `reason`: not_approved, day_off, off_today or not_on_shift; the app explains it. */
    static courierNotAvailable(courierId: string, reason: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "COURIER_NOT_AVAILABLE",
            "This courier cannot take an order now",
            { courierId, reason },
        )
    }

    /** Another network courier pressed «Беру» first, or the shop took the order back. */
    static networkOrderTaken(orderId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "NETWORK_ORDER_TAKEN",
            "This order was already taken",
            { orderId },
        )
    }

    /** The shop's location is in no district of the delivery network. */
    static noDistrict(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "NO_DISTRICT",
            "The shop is outside every district of the delivery network",
            { businessId },
        )
    }

    static notInMarketplace(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "NOT_IN_MARKETPLACE",
            "The shop has no marketplace agreement",
            { businessId },
        )
    }

    /** A transfer is paid before the shop starts: the order is accepted only after it arrived. */
    static paymentRequired(orderId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYMENT_REQUIRED",
            "The transfer has not arrived yet",
            { orderId },
        )
    }

    /** A shop that takes only transfers cannot take orders without a card. */
    static noPayoutCard(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "NO_PAYOUT_CARD",
            "The shop has no card for transfers yet",
            { businessId },
        )
    }

    static payoutCardLimit(max: number): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYOUT_CARD_LIMIT",
            `A shop keeps at most ${max} cards`,
            { max },
        )
    }

    static cardExists(): BusinessRuleViolationError {
        return new BusinessRuleViolationError("CARD_EXISTS", "This card is already added")
    }

    /** Customers are shown this card: choose another one before removing it. */
    static paymentCardInUse(cardId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYMENT_CARD_IN_USE",
            "Customers pay to this card; choose another payment card first",
            { cardId },
        )
    }

    static paymentNotConfirmable(status: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYMENT_NOT_CONFIRMABLE",
            "Only an unpaid or awaited payment can be confirmed",
            { status },
        )
    }

    static notRejected(businessId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "SHOP_NOT_REJECTED",
            "Only a rejected application can be sent again",
            { businessId },
        )
    }

    static paymentNotRejectable(status: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYMENT_NOT_REJECTABLE",
            "Only a transfer the customer reported can be marked as not found",
            { status },
        )
    }

    static remindTooSoon(at: string | undefined): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "REMIND_TOO_SOON",
            "The shop was asked a moment ago; it can be asked again later",
            at ? { at } : undefined,
        )
    }

    static receiptRequired(): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "RECEIPT_REQUIRED",
            "Attach the screenshot of the transfer",
        )
    }

    static paymentNotRefundable(status: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYMENT_NOT_REFUNDABLE",
            "Only money owed back can be marked as refunded",
            { status },
        )
    }

    /** The customer chose a way of paying the shop does not take. */
    static paymentMethodUnavailable(method: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "PAYMENT_METHOD_UNAVAILABLE",
            "The shop does not take this way of paying",
            { method },
        )
    }

    /** «O'tkazdim», «Pul keldi», «Pul kelmadi»: only for an order paid by transfer. */
    static notATransfer(orderId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "NOT_A_TRANSFER",
            "This order is paid in cash to the courier",
            { orderId },
        )
    }

    /** Cash orders go only with the shop's own couriers: a network courier carries no money. */
    static cashNotForNetwork(orderId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "CASH_NOT_FOR_NETWORK",
            "A cash order is delivered only by the shop's own courier",
            { orderId },
        )
    }

    /** «Pulni oldim»: only cash a courier collected and has not handed over yet. */
    static cashNotWithCourier(orderId: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "CASH_NOT_WITH_COURIER",
            "No courier holds this order's cash",
            { orderId },
        )
    }

    /** A trip has 2..10 stops, each an order of this shop with the customer's pin. */
    static tripStops(min: number, max: number): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "TRIP_STOPS",
            `A trip has from ${min} to ${max} orders with the customer's place`,
            { min, max },
        )
    }

    /** This order cannot join a trip (taken by the network, already in a trip, no place). */
    static notForTrip(orderId: string, why: string): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "NOT_FOR_TRIP",
            `Order "${orderId}" cannot join a trip: ${why}`,
            { orderId, why },
        )
    }

    /** «Hammasini oldim» only when every order of the trip is ready. */
    static tripNotReady(ready: number, total: number): BusinessRuleViolationError {
        return new BusinessRuleViolationError(
            "TRIP_NOT_READY",
            `${ready} of ${total} orders are ready`,
            { ready, total },
        )
    }
}
