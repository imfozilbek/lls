import { addDays, startOfLocalDay } from "../../../domain/shared/time.js"
import { requireOwnedBusiness } from "../shared.js"

import type { ShopStatsDTO } from "../../dtos/stats.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { OrderRepository } from "../../ports/order-repository.js"

const WEEK_DAYS = 7

/** Orders and revenue for today and the last 7 days, in Tashkent time. */
export class GetShopStatsUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly orders: OrderRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorTelegramId: number; businessId: string }): Promise<ShopStatsDTO> {
        await requireOwnedBusiness(this.businesses, input.businessId, input.actorTelegramId)
        const todayStart = startOfLocalDay(this.clock.now())
        const tomorrow = addDays(todayStart, 1)
        const weekStart = addDays(todayStart, 1 - WEEK_DAYS)
        const [today, week] = await Promise.all([
            this.orders.stats(input.businessId, todayStart, tomorrow),
            this.orders.stats(input.businessId, weekStart, tomorrow),
        ])
        return { today, week }
    }
}
