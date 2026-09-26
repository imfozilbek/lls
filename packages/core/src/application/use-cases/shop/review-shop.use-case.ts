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
            business.disable()
        }
        await this.businesses.save(business)
        return toShopOwnerDTO(business, this.clock.now())
    }
}
