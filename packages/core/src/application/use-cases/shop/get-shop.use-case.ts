import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toShopOwnerDTO, toShopPublicDTO } from "../../dtos/shop.dto.js"

import { shopCallPhone } from "./shop-phone.js"

import type { ShopOwnerDTO, ShopPublicDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"
import type { SupportGroupRepository } from "../../ports/support.js"

/**
 * Storefront entry: a turned-off or rejected shop is visible only to its owner. It carries the
 * number to call the shop on (its own, or the owner's), unless the owner hides it from customers
 * while the support group answers them (goal 24); the owner always sees it.
 */
export class GetShopBySlugUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
        private readonly customers: Pick<CustomerRepository, "findByTelegramId">,
        /** Whether the shop answers messages (`supportChat`): one row read when given. */
        private readonly supportGroups?: Pick<SupportGroupRepository, "find">,
    ) {}

    async execute(slug: string, viewerTelegramId?: number): Promise<ShopPublicDTO> {
        const business = await this.businesses.findBySlug(slug)
        if (!business?.isVisibleTo(viewerTelegramId)) {
            throw EntityNotFoundError.businessBySlug(slug)
        }
        const callPhone = await shopCallPhone(business, this.customers)
        const supportChat = Boolean(await this.supportGroups?.find(business.id))
        const isOwner = viewerTelegramId === business.ownerTelegramId.value
        // No number to call, no orders: the storefront says it will start taking them soon. A
        // hidden number is still a number: the shop takes orders, customers write instead.
        return toShopPublicDTO(business, this.clock.now(), {
            withCard: true,
            withPhone: isOwner || business.showsPhoneToCustomers(supportChat),
            callPhone,
            noPhone: callPhone === undefined && !business.isDemo(),
            supportChat,
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
