import { Business } from "../../../domain/entities/business.js"
import { PayoutCardBook } from "../../../domain/entities/payout-card-book.js"
import { BotSource } from "../../../domain/enums/bot-source.js"
import { ConflictError } from "../../../domain/errors/conflict.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { Location } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { PayoutCard } from "../../../domain/value-objects/payout-card.js"
import { Slug } from "../../../domain/value-objects/slug.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { toShopOwnerDTO } from "../../dtos/shop.dto.js"
import { districtIdFor } from "../network/network.use-cases.js"

import type { SavedPayoutCard } from "../../../domain/entities/payout-card-book.js"
import type { BusinessType } from "../../../domain/enums/business-type.js"
import type { LocationDTO, ShopOwnerDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { DistrictRepository } from "../../ports/district-repository.js"
import type { ManagedBotRepository } from "../../ports/managed-bot-repository.js"

const MAX_SLUG_ATTEMPTS = 20

/** A bot made in @BotFather: its token is pasted and already verified with `getMe`. */
export interface PastedBot {
    id: number
    username: string
    token: string
}

/** A bot the owner created from the Zumda bot: Zumda already holds its token. */
export interface ManagedBotChoice {
    managedBotId: number
}

export interface RegisterShopInput {
    ownerTelegramId: number
    bot: PastedBot | ManagedBotChoice
    name: string
    type: BusinessType
    address?: string
    location?: LocationDTO
    /** Zero until the owner sets it in «Ishga tayyor». */
    deliveryFee?: number
    freeDeliveryFrom?: number
    minOrder?: number
    /**
     * Customers pay only by transfer, but the card may come later («Ishga tayyor»): until then
     * the shop takes no orders (`NO_PAYOUT_CARD`).
     */
    payoutCard?: { number: string; holder: string }
}

/** Self-serve onboarding: the owner connects their own bot. The shop waits for admin approval. */
export class RegisterShopUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
        private readonly managedBots: ManagedBotRepository,
        private readonly districts: DistrictRepository,
    ) {}

    async execute(input: RegisterShopInput): Promise<ShopOwnerDTO> {
        const bot = await this.botOf(input)
        if (await this.businesses.findByBotId(bot.id)) {
            throw ConflictError.botAlreadyConnected(bot.id)
        }

        const location = input.location
            ? Location.create(input.location.latitude, input.location.longitude)
            : undefined
        const business = Business.register({
            id: crypto.randomUUID(),
            slug: await this.freeSlug(Slug.fromBotUsername(bot.username)),
            name: input.name,
            type: input.type,
            ownerTelegramId: TelegramId.create(input.ownerTelegramId),
            bot: { id: bot.id, username: bot.username },
            botSource: bot.source,
            address: input.address,
            location,
            delivery: {
                fee: Money.of(input.deliveryFee ?? 0),
                freeFrom: Money.optional(input.freeDeliveryFrom),
                minOrder: Money.optional(input.minOrder),
            },
        })

        // A shop with a location belongs to its district at once: the network can serve it.
        business.setDistrict(await districtIdFor(this.districts, location))
        const card = input.payoutCard && this.firstCard(business, input.payoutCard)
        await this.businesses.insert(business, bot.token, card)
        if (bot.source === BotSource.MANAGED) {
            await this.managedBots.claim(bot.id, business.id)
        }
        return toShopOwnerDTO(business, this.clock.now())
    }

    /** The card the application came with: it becomes the payment card customers see. */
    private firstCard(
        business: Business,
        card: { number: string; holder: string },
    ): SavedPayoutCard {
        return new PayoutCardBook(business, []).add({
            id: crypto.randomUUID(),
            card: PayoutCard.create(card.number, card.holder),
            now: this.clock.now(),
        })
    }

    /** A managed bot must be this owner's own and not taken by a shop yet. */
    private async botOf(input: RegisterShopInput): Promise<PastedBot & { source: BotSource }> {
        if (!("managedBotId" in input.bot)) {
            return { ...input.bot, source: BotSource.TOKEN }
        }
        const id = input.bot.managedBotId
        const record = await this.managedBots.find(id)
        const token = record ? await this.managedBots.token(id) : null
        if (
            !record ||
            !token ||
            record.ownerTelegramId !== input.ownerTelegramId ||
            record.businessId !== undefined
        ) {
            throw EntityNotFoundError.managedBot(id)
        }
        return { id, username: record.username, token, source: BotSource.MANAGED }
    }

    private async freeSlug(base: Slug): Promise<Slug> {
        for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
            const candidate = attempt === 1 ? base : base.withSuffix(attempt)
            if (!(await this.businesses.findBySlug(candidate.value))) {
                return candidate
            }
        }
        throw ConflictError.slugTaken(base.value)
    }
}
