import { DomainError } from "./domain-error.js"

export class EntityNotFoundError extends DomainError {
    readonly code = "ENTITY_NOT_FOUND"

    constructor(
        public readonly entityName: string,
        public readonly entityId: string,
    ) {
        super(`${entityName} with id "${entityId}" not found`, {
            entityName,
            entityId,
        })
    }

    static business(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Business", id)
    }

    static product(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Product", id)
    }

    static customer(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Customer", id)
    }

    static courier(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Courier", id)
    }

    static order(id: string): EntityNotFoundError {
        return new EntityNotFoundError("Order", id)
    }

    static businessByTelegramId(telegramId: number): EntityNotFoundError {
        return new EntityNotFoundError("Business", `telegram:${telegramId}`)
    }
}
