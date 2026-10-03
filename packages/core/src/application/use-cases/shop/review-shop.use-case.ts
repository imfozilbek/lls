import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { toShopOwnerDTO } from "../../dtos/shop.dto.js"
import { requireBusiness } from "../shared.js"

import type { ShopOwnerDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"

export interface ReviewShopInput {
    actorTelegramId: number
    businessId: string
    decision: "approve" | "reject"
    /** Why an application is rejected: the owner reads it and fixes the application. */
    reason?: string
}

/** A platform admin approves or rejects a new shop. */
export class ReviewShopUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly platformAdminIds: readonly number[],
        private readonly clock: Clock,
    ) {}

    async execute(input: ReviewShopInput): Promise<ShopOwnerDTO> {
        if (!this.platformAdminIds.includes(input.actorTelegramId)) {
            throw ForbiddenError.notPlatformAdmin()
        }
        const business = await requireBusiness(this.businesses, input.businessId)
        if (input.decision === "approve") {
            business.approve()
        } else {
            business.reject(input.reason, this.clock.now())
        }
        await this.businesses.save(business)
        return toShopOwnerDTO(business, this.clock.now())
    }
}

/** The owner fixed a rejected application and sends it to the admins again. */
export class ResubmitShopUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: { ownerTelegramId: number; businessId: string }): Promise<ShopOwnerDTO> {
        const business = await requireBusiness(this.businesses, input.businessId)
        if (!business.isOwnedBy(input.ownerTelegramId)) {
            throw ForbiddenError.notOwner(business.id)
        }
        business.resubmit()
        await this.businesses.save(business)
        return toShopOwnerDTO(business, this.clock.now())
    }
}
