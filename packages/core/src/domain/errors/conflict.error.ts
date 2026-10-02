import { DomainError } from "./domain-error.js"

export class ConflictError extends DomainError {
    readonly code = "CONFLICT"

    static botAlreadyConnected(botId: number): ConflictError {
        return new ConflictError(`Bot ${botId} is already connected to a shop`, { botId })
    }

    static slugTaken(slug: string): ConflictError {
        return new ConflictError(`Shop address "${slug}" is taken`, { slug })
    }

    static courierAlreadyReviewed(courierId: string): ConflictError {
        return new ConflictError("This courier was already approved or declined", { courierId })
    }
}
