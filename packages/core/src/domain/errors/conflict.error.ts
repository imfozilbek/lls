import { DomainError } from "./domain-error.js"

/** The `reason` goes to the app as the error code, so each conflict has its own words. */
export type ConflictReason =
    | "CONFLICT"
    | "BOT_TAKEN"
    | "SLUG_TAKEN"
    | "COURIER_ALREADY_REVIEWED"
    | "SHOP_ALREADY_REVIEWED"
    | "DISTRICT_EXISTS"
    | "STALE"

export class ConflictError extends DomainError {
    readonly code = "CONFLICT"

    constructor(
        message: string,
        details?: Record<string, unknown>,
        public readonly reason: ConflictReason = "CONFLICT",
    ) {
        super(message, details)
    }

    static botAlreadyConnected(botId: number): ConflictError {
        return new ConflictError(
            `Bot ${botId} is already connected to a shop`,
            { botId },
            "BOT_TAKEN",
        )
    }

    static slugTaken(slug: string): ConflictError {
        return new ConflictError(`Shop address "${slug}" is taken`, { slug }, "SLUG_TAKEN")
    }

    static courierAlreadyReviewed(courierId: string): ConflictError {
        return new ConflictError(
            "This courier was already approved or declined",
            { courierId },
            "COURIER_ALREADY_REVIEWED",
        )
    }

    /** An old application card: the shop was approved, rejected or turned off since. */
    static shopAlreadyReviewed(businessId: string, status: string): ConflictError {
        return new ConflictError(
            "This application was already decided",
            { businessId, status },
            "SHOP_ALREADY_REVIEWED",
        )
    }

    /** A new district with the name of one that exists: change that one instead. */
    static districtExists(name: string): ConflictError {
        return new ConflictError(`District "${name}" already exists`, { name }, "DISTRICT_EXISTS")
    }

    /** Someone changed the same record a moment earlier: load it again and retry. */
    static stale(entity: string, id: string): ConflictError {
        return new ConflictError(`The ${entity} changed meanwhile, try again`, { id }, "STALE")
    }
}
