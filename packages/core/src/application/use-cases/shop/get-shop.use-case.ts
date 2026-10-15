import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toShopOwnerDTO, toShopPublicDTO } from "../../dtos/shop.dto.js"

import { shopCallPhone } from "./shop-phone.js"

import type { ShopOwnerDTO, ShopPublicDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"

/**
 * Storefront entry: a turned-off or rejected shop is visible only to its owner. It carries the
 * number to call the shop on (its own, or the owner's).
 */
export class GetShopBySlugUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
        private readonly customers: Pick<CustomerRepository, "findByTelegramId">,
    ) {}

    async execute(slug: string, viewerTelegramId?: number): Promise<ShopPublicDTO> {
        const business = await this.businesses.findBySlug(slug)
        if (!business?.isVisibleTo(viewerTelegramId)) {
            throw EntityNotFoundError.businessBySlug(slug)
        }
        const callPhone = await shopCallPhone(business, this.customers)
        // No number to call, no orders: the storefront says it will start taking them soon.
        return toShopPublicDTO(business, this.clock.now(), {
            withCard: true,
            callPhone,
            noPhone: callPhone === undefined && !business.isDemo(),
        })
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
