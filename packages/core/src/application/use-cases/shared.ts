import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"

import type { Business } from "../../domain/entities/business.js"
import type { BusinessRepository } from "../ports/business-repository.js"

export async function requireBusiness(
    businesses: BusinessRepository,
    businessId: string,
): Promise<Business> {
    const business = await businesses.findById(businessId)
    if (!business) {
        throw EntityNotFoundError.business(businessId)
    }
    return business
}

/** Loads the shop and checks that the caller is its owner. */
export async function requireOwnedBusiness(
    businesses: BusinessRepository,
    businessId: string,
    actorTelegramId: number,
): Promise<Business> {
    const business = await requireBusiness(businesses, businessId)
    if (!business.isOwnedBy(actorTelegramId)) {
        throw ForbiddenError.notOwner(businessId)
    }
    return business
}
