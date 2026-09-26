import { DomainError } from "./domain-error.js"

export class ForbiddenError extends DomainError {
    readonly code = "FORBIDDEN"

    static notOwner(businessId: string): ForbiddenError {
        return new ForbiddenError("Only the shop owner can do this", { businessId })
    }

    static notOrderParticipant(orderId: string): ForbiddenError {
        return new ForbiddenError("This order belongs to someone else", { orderId })
    }

    static notPlatformAdmin(): ForbiddenError {
        return new ForbiddenError("Only a platform admin can do this")
    }
}
