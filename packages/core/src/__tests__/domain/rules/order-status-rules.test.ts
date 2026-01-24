import { describe, it, expect } from "vitest"

import {
    isValidTransition,
    getValidNextStatuses,
    canBeCancelled,
    isFinalStatus,
    getStatusFlow,
    getStatusIndex,
    calculateProgress,
} from "../../../domain/rules/order-status-rules.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"

describe("isValidTransition", () => {
    it("should allow PENDING → ACCEPTED", () => {
        expect(isValidTransition(OrderStatus.PENDING, OrderStatus.ACCEPTED)).toBe(true)
    })

    it("should allow PENDING → CANCELLED", () => {
        expect(isValidTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true)
    })

    it("should not allow PENDING → DELIVERED", () => {
        expect(isValidTransition(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false)
    })

    it("should allow ACCEPTED → PREPARING", () => {
        expect(isValidTransition(OrderStatus.ACCEPTED, OrderStatus.PREPARING)).toBe(true)
    })

    it("should allow PREPARING → READY", () => {
        expect(isValidTransition(OrderStatus.PREPARING, OrderStatus.READY)).toBe(true)
    })

    it("should allow READY → PICKED_UP", () => {
        expect(isValidTransition(OrderStatus.READY, OrderStatus.PICKED_UP)).toBe(true)
    })

    it("should allow PICKED_UP → DELIVERED", () => {
        expect(isValidTransition(OrderStatus.PICKED_UP, OrderStatus.DELIVERED)).toBe(true)
    })

    it("should not allow any transition from DELIVERED", () => {
        expect(isValidTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false)
        expect(isValidTransition(OrderStatus.DELIVERED, OrderStatus.PENDING)).toBe(false)
    })

    it("should not allow any transition from CANCELLED", () => {
        expect(isValidTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false)
        expect(isValidTransition(OrderStatus.CANCELLED, OrderStatus.ACCEPTED)).toBe(false)
    })
})

describe("getValidNextStatuses", () => {
    it("should return [ACCEPTED, CANCELLED] for PENDING", () => {
        const statuses = getValidNextStatuses(OrderStatus.PENDING)
        expect(statuses).toContain(OrderStatus.ACCEPTED)
        expect(statuses).toContain(OrderStatus.CANCELLED)
    })

    it("should return empty array for DELIVERED", () => {
        const statuses = getValidNextStatuses(OrderStatus.DELIVERED)
        expect(statuses).toHaveLength(0)
    })

    it("should return empty array for CANCELLED", () => {
        const statuses = getValidNextStatuses(OrderStatus.CANCELLED)
        expect(statuses).toHaveLength(0)
    })
})

describe("canBeCancelled", () => {
    it("should return true for PENDING", () => {
        expect(canBeCancelled(OrderStatus.PENDING)).toBe(true)
    })

    it("should return true for ACCEPTED", () => {
        expect(canBeCancelled(OrderStatus.ACCEPTED)).toBe(true)
    })

    it("should return false for PREPARING (resources committed)", () => {
        expect(canBeCancelled(OrderStatus.PREPARING)).toBe(false)
    })

    it("should return false for READY (order is ready)", () => {
        expect(canBeCancelled(OrderStatus.READY)).toBe(false)
    })

    it("should return false for PICKED_UP (courier is delivering)", () => {
        expect(canBeCancelled(OrderStatus.PICKED_UP)).toBe(false)
    })

    it("should return false for DELIVERED", () => {
        expect(canBeCancelled(OrderStatus.DELIVERED)).toBe(false)
    })

    it("should return false for CANCELLED", () => {
        expect(canBeCancelled(OrderStatus.CANCELLED)).toBe(false)
    })
})

describe("isFinalStatus", () => {
    it("should return true for DELIVERED", () => {
        expect(isFinalStatus(OrderStatus.DELIVERED)).toBe(true)
    })

    it("should return true for CANCELLED", () => {
        expect(isFinalStatus(OrderStatus.CANCELLED)).toBe(true)
    })

    it("should return false for PENDING", () => {
        expect(isFinalStatus(OrderStatus.PENDING)).toBe(false)
    })

    it("should return false for PICKED_UP", () => {
        expect(isFinalStatus(OrderStatus.PICKED_UP)).toBe(false)
    })
})

describe("getStatusFlow", () => {
    it("should return correct order flow", () => {
        const flow = getStatusFlow()
        expect(flow).toEqual([
            OrderStatus.PENDING,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.PICKED_UP,
            OrderStatus.DELIVERED,
        ])
    })

    it("should not include CANCELLED", () => {
        const flow = getStatusFlow()
        expect(flow).not.toContain(OrderStatus.CANCELLED)
    })
})

describe("getStatusIndex", () => {
    it("should return 0 for PENDING", () => {
        expect(getStatusIndex(OrderStatus.PENDING)).toBe(0)
    })

    it("should return 5 for DELIVERED", () => {
        expect(getStatusIndex(OrderStatus.DELIVERED)).toBe(5)
    })

    it("should return -1 for CANCELLED", () => {
        expect(getStatusIndex(OrderStatus.CANCELLED)).toBe(-1)
    })
})

describe("calculateProgress", () => {
    it("should return 0 for PENDING", () => {
        expect(calculateProgress(OrderStatus.PENDING)).toBe(0)
    })

    it("should return 20 for ACCEPTED", () => {
        expect(calculateProgress(OrderStatus.ACCEPTED)).toBe(20)
    })

    it("should return 40 for PREPARING", () => {
        expect(calculateProgress(OrderStatus.PREPARING)).toBe(40)
    })

    it("should return 60 for READY", () => {
        expect(calculateProgress(OrderStatus.READY)).toBe(60)
    })

    it("should return 80 for PICKED_UP", () => {
        expect(calculateProgress(OrderStatus.PICKED_UP)).toBe(80)
    })

    it("should return 100 for DELIVERED", () => {
        expect(calculateProgress(OrderStatus.DELIVERED)).toBe(100)
    })

    it("should return 0 for CANCELLED", () => {
        expect(calculateProgress(OrderStatus.CANCELLED)).toBe(0)
    })
})
