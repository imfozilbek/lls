import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toShopOwnerDTO, toShopPublicDTO } from "../../dtos/shop.dto.js"

import type { ShopOwnerDTO, ShopPublicDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"

/** Storefront entry: an inactive shop is visible only to its owner. */
export class GetShopBySlugUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
    ) {}

    async execute(slug: string, viewerTelegramId?: number): Promise<ShopPublicDTO> {
        const business = await this.businesses.findBySlug(slug)
        const isOwner = viewerTelegramId !== undefined && business?.isOwnedBy(viewerTelegramId)
        if (!business || (!business.isActive() && !isOwner)) {
            throw EntityNotFoundError.businessBySlug(slug)
        }
        return toShopPublicDTO(business, this.clock.now())
    }
}

/** Shops owned by the caller (platform bot: "my shops"). */
export class ListMyShopsUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
    ) {}

    async execute(ownerTelegramId: number): Promise<ShopOwnerDTO[]> {
        const now = this.clock.now()
        const shops = await this.businesses.listByOwner(ownerTelegramId)
        return shops.map((shop) => toShopOwnerDTO(shop, now))
    }
}
