import { DomainError } from "./domain-error.js"

export class EntityNotFoundError extends DomainError {
    readonly code = "ENTITY_NOT_FOUND"

    constructor(
        public readonly entityName: string,
        public readonly entityId: string,
    ) {
        super(`${entityName} "${entityId}" not found`, { entityName, entityId })
    }

    static business(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Business", id)
    }

    static businessBySlug(slug: string): EntityNotFoundError {
        return new EntityNotFoundError("Business", `slug:${slug}`)
    }

    static product(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Product", id)
    }

    static courier(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Courier", id)
    }

    static trip(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Trip", id)
    }

    static invite(): EntityNotFoundError {
        return new EntityNotFoundError("CourierInvite", "code")
    }

    static payoutCard(id: string): EntityNotFoundError {
        return new EntityNotFoundError("PayoutCard", id)
    }

    /** Not created from the Zumda bot by this owner, or already taken by a shop. */
    static managedBot(botId: number): EntityNotFoundError {
        return new EntityNotFoundError("ManagedBot", String(botId))
    }

    static order(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Order", id)
    }
}
