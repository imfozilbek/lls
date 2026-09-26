import { describe, expect, it } from "vitest"

import { OrderStatus } from "../../../domain/enums/order-status.js"
import {
    BusinessRuleViolationError,
    ConflictError,
    DomainError,
    EntityNotFoundError,
    ForbiddenError,
    InvalidOrderTransitionError,
    ValidationError,
} from "../../../domain/errors/index.js"

describe("domain errors", () => {
    it("all extend DomainError with a stable code", () => {
        const errors: DomainError[] = [
            ValidationError.fromField("name", "required"),
            EntityNotFoundError.order("o-1"),
            new InvalidOrderTransitionError("o-1", OrderStatus.PENDING, OrderStatus.DELIVERED),
            BusinessRuleViolationError.emptyOrder(),
            ForbiddenError.notOwner("b-1"),
            ConflictError.slugTaken("osh"),
        ]
        expect(errors.map((e) => e.code)).toEqual([
            "VALIDATION_ERROR",
            "ENTITY_NOT_FOUND",
            "INVALID_ORDER_TRANSITION",
            "BUSINESS_RULE_VIOLATION",
            "FORBIDDEN",
            "CONFLICT",
        ])
        for (const error of errors) {
            expect(error).toBeInstanceOf(DomainError)
            expect(error).toBeInstanceOf(Error)
        }
    })

    it("not found factories name the entity", () => {
        expect(EntityNotFoundError.business("1").entityName).toBe("Business")
        expect(EntityNotFoundError.businessBySlug("osh").entityId).toBe("slug:osh")
        expect(EntityNotFoundError.product("1").entityName).toBe("Product")
    })

    it("business rule factories carry the rule id", () => {
        expect(BusinessRuleViolationError.tooManyItems(50).rule).toBe("TOO_MANY_ITEMS")
        expect(BusinessRuleViolationError.productNotAvailable("p").rule).toBe(
            "PRODUCT_NOT_AVAILABLE",
        )
        expect(BusinessRuleViolationError.shopNotActive("b").rule).toBe("SHOP_NOT_ACTIVE")
        expect(BusinessRuleViolationError.shopClosed("b").rule).toBe("SHOP_CLOSED")
        expect(BusinessRuleViolationError.notAcceptingOrders("b").rule).toBe("NOT_ACCEPTING_ORDERS")
        expect(BusinessRuleViolationError.minOrderNotReached(1, 0).details).toMatchObject({
            minOrder: 1,
            subtotal: 0,
        })
        expect(BusinessRuleViolationError.outsideDeliveryZone(5000).rule).toBe(
            "OUTSIDE_DELIVERY_ZONE",
        )
        expect(BusinessRuleViolationError.phoneRequired().rule).toBe("PHONE_REQUIRED")
        expect(BusinessRuleViolationError.orderCannotBeCancelled("o", "accepted").rule).toBe(
            "ORDER_CANNOT_BE_CANCELLED",
        )
        expect(BusinessRuleViolationError.shopAlreadyActive("b").rule).toBe("SHOP_ALREADY_ACTIVE")
    })

    it("forbidden and conflict factories", () => {
        expect(ForbiddenError.notOrderParticipant("o").details).toEqual({ orderId: "o" })
        expect(ForbiddenError.notPlatformAdmin().code).toBe("FORBIDDEN")
        expect(ConflictError.botAlreadyConnected(7).details).toEqual({ botId: 7 })
    })

    it("serializes to JSON", () => {
        const json = ForbiddenError.notOwner("b-1").toJSON()
        expect(json).toMatchObject({ name: "ForbiddenError", code: "FORBIDDEN" })
    })
})
