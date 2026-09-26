import { DomainError } from "./domain-error.js"

export class ForbiddenError extends DomainError {
    readonly code = "FORBIDDEN"

    static notOwner(businessId: string): ForbiddenError {
        return new ForbiddenError("Only the shop owner can do this", { businessId })
    }

    static notOrderParticipant(orderId: string): ForbiddenError {
        return new ForbiddenError("This order belongs to someone else", { orderId })
    }

    static notCourier(businessId: string): ForbiddenError {
        return new ForbiddenError("Only a courier of this shop can do this", { businessId })
    }

    static notAssignedCourier(orderId: string): ForbiddenError {
        return new ForbiddenError("This order is assigned to another courier", { orderId })
    }

    static stepNotAllowed(orderId: string, to: string): ForbiddenError {
        return new ForbiddenError("You cannot move the order to this status", { orderId, to })
    }

    static notPlatformAdmin(): ForbiddenError {
        return new ForbiddenError("Only a platform admin can do this")
    }
}
