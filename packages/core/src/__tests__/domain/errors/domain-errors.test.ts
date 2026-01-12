import { describe, it, expect } from "vitest"

import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { DomainError } from "../../../domain/errors/domain-error.js"
import { InvalidOrderTransitionError } from "../../../domain/errors/invalid-transition.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"

describe("DomainErrors", () => {
    describe("ValidationError", () => {
        it("should create validation error", () => {
            const error = new ValidationError("Invalid input", [
                { field: "name", message: "Name is required" },
            ])
            expect(error.code).toBe("VALIDATION_ERROR")
            expect(error.errors).toHaveLength(1)
        })

        it("should create from field", () => {
            const error = ValidationError.fromField("email", "Invalid email")
            expect(error.errors[0]?.field).toBe("email")
        })

        it("should create from fields", () => {
            const error = ValidationError.fromFields([
                { field: "name", message: "Required" },
                { field: "email", message: "Invalid" },
            ])
            expect(error.errors).toHaveLength(2)
        })
    })

    describe("EntityNotFoundError", () => {
        it("should create entity not found error", () => {
            const error = new EntityNotFoundError("Business", "123")
            expect(error.code).toBe("ENTITY_NOT_FOUND")
            expect(error.entityName).toBe("Business")
            expect(error.entityId).toBe("123")
        })

        it("should have factory methods", () => {
            expect(EntityNotFoundError.business("1").entityName).toBe("Business")
            expect(EntityNotFoundError.product("1").entityName).toBe("Product")
            expect(EntityNotFoundError.customer("1").entityName).toBe("Customer")
            expect(EntityNotFoundError.courier("1").entityName).toBe("Courier")
            expect(EntityNotFoundError.order("1").entityName).toBe("Order")
        })
    })

    describe("InvalidOrderTransitionError", () => {
        it("should create invalid transition error", () => {
            const error = new InvalidOrderTransitionError(
                "order-1",
                OrderStatus.PENDING,
                OrderStatus.DELIVERED,
            )
            expect(error.code).toBe("INVALID_ORDER_TRANSITION")
            expect(error.fromStatus).toBe(OrderStatus.PENDING)
            expect(error.toStatus).toBe(OrderStatus.DELIVERED)
        })
    })

    describe("BusinessRuleViolationError", () => {
        it("should create business rule error", () => {
            const error = new BusinessRuleViolationError("TEST_RULE", "Test message")
            expect(error.code).toBe("BUSINESS_RULE_VIOLATION")
            expect(error.rule).toBe("TEST_RULE")
        })

        it("should have factory methods", () => {
            expect(BusinessRuleViolationError.orderAlreadyHasCourier("1").rule).toBe(
                "ORDER_ALREADY_HAS_COURIER",
            )
            expect(BusinessRuleViolationError.courierNotAvailable("1").rule).toBe(
                "COURIER_NOT_AVAILABLE",
            )
            expect(BusinessRuleViolationError.orderRequiresCourier("1").rule).toBe(
                "ORDER_REQUIRES_COURIER",
            )
            expect(BusinessRuleViolationError.emptyOrder().rule).toBe("EMPTY_ORDER")
        })
    })

    describe("DomainError", () => {
        it("should serialize to JSON", () => {
            const error = EntityNotFoundError.business("123")
            const json = error.toJSON()
            expect(json.code).toBe("ENTITY_NOT_FOUND")
            expect(json.name).toBe("EntityNotFoundError")
        })

        it("should be instanceof Error", () => {
            const error = EntityNotFoundError.business("123")
            expect(error).toBeInstanceOf(Error)
            expect(error).toBeInstanceOf(DomainError)
        })
    })
})
