import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { toPlatformShopDTO } from "../../dtos/shop.dto.js"

import type { BusinessStatus } from "../../../domain/enums/business-status.js"
import type { PlatformShopDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"

/** One screen of «Platforma»: enough for a district, small enough to read in one go. */
export const PLATFORM_SHOPS_LIMIT = 200

/** The admin's «Platforma»: applications, live shops or turned-off ones, with their owners. */
export class ListPlatformShopsUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly customers: CustomerRepository,
        private readonly platformAdminIds: readonly number[],
        private readonly clock: Clock,
    ) {}

    async execute(input: {
        actorTelegramId: number
        status: BusinessStatus
    }): Promise<PlatformShopDTO[]> {
        if (!this.platformAdminIds.includes(input.actorTelegramId)) {
            throw ForbiddenError.notPlatformAdmin()
        }
        const shops = await this.businesses.listByStatus(input.status, PLATFORM_SHOPS_LIMIT)
        const ownerIds = [...new Set(shops.map((shop) => shop.ownerTelegramId.value))]
        const owners = await this.customers.findManyByTelegramIds(ownerIds)
        const byId = new Map(owners.map((owner) => [owner.telegramId.value, owner]))
        const now = this.clock.now()
        return shops.map((shop) =>
            toPlatformShopDTO(shop, byId.get(shop.ownerTelegramId.value), now),
        )
    }
}
