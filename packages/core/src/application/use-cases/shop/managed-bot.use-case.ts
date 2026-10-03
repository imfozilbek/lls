import { toShopOwnerDTO } from "../../dtos/shop.dto.js"

import type { ShopOwnerDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { ManagedBotRepository } from "../../ports/managed-bot-repository.js"

export interface ManagedBotChangedInput {
    bot: { id: number; username: string }
    /** `managed_bot.user`: who created (now owns) the bot in Telegram. */
    ownerTelegramId: number
    /** Fetched by the adapter with `getManagedBotToken`. */
    token: string
}

export type ManagedBotChange =
    /** A new bot, waiting for its owner's application. */
    | { kind: "created"; botUsername: string }
    /** The shop's bot got a new token: the adapter connects it again. */
    | { kind: "tokenChanged"; shop: ShopOwnerDTO }
    /**
     * Someone else owns the shop's bot now. The shop is not handed over silently: the admins
     * decide. The token is kept current so the shop keeps working meanwhile.
     */
    | { kind: "ownerChanged"; shop: ShopOwnerDTO; newOwnerTelegramId: number }

/** The Zumda bot heard `managed_bot`: a bot was created, its token or its owner changed. */
export class ManagedBotChangedUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly managedBots: ManagedBotRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: ManagedBotChangedInput): Promise<ManagedBotChange> {
        const known = await this.managedBots.find(input.bot.id)
        const business = await this.businesses.findByBotId(input.bot.id)
        await this.managedBots.record(
            {
                botId: input.bot.id,
                username: input.bot.username,
                ownerTelegramId: input.ownerTelegramId,
                businessId: known?.businessId ?? business?.id,
            },
            input.token,
        )
        if (!business) {
            return { kind: "created", botUsername: input.bot.username }
        }
        await this.businesses.replaceBotToken(business.id, input.token)
        const shop = toShopOwnerDTO(business, this.clock.now())
        if (!business.isOwnedBy(input.ownerTelegramId)) {
            return { kind: "ownerChanged", shop, newOwnerTelegramId: input.ownerTelegramId }
        }
        return { kind: "tokenChanged", shop }
    }
}

/** The owner's bots created from the Zumda bot that no shop took yet. */
export class ListMyManagedBotsUseCase {
    constructor(private readonly managedBots: ManagedBotRepository) {}

    async execute(ownerTelegramId: number): Promise<{ botId: number; username: string }[]> {
        const bots = await this.managedBots.listUnclaimed(ownerTelegramId)
        return bots.map((bot) => ({ botId: bot.botId, username: bot.username }))
    }
}
