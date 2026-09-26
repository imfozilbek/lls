import { Business } from "../../../domain/entities/business.js"
import { ConflictError } from "../../../domain/errors/conflict.error.js"
import { Location } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { Slug } from "../../../domain/value-objects/slug.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { toShopOwnerDTO } from "../../dtos/shop.dto.js"

import type { BusinessType } from "../../../domain/enums/business-type.js"
import type { LocationDTO, ShopOwnerDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"

const MAX_SLUG_ATTEMPTS = 20

export interface RegisterShopInput {
    ownerTelegramId: number
    /** Already verified with Telegram `getMe` by the adapter. */
    bot: { id: number; username: string; token: string }
    name: string
    type: BusinessType
    address?: string
    location?: LocationDTO
    deliveryFee: number
    freeDeliveryFrom?: number
    minOrder?: number
}

/** Self-serve onboarding: the owner connects their own bot. The shop waits for admin approval. */
export class RegisterShopUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: RegisterShopInput): Promise<ShopOwnerDTO> {
        if (await this.businesses.findByBotId(input.bot.id)) {
            throw ConflictError.botAlreadyConnected(input.bot.id)
        }

        const business = Business.register({
            id: crypto.randomUUID(),
            slug: await this.freeSlug(Slug.fromBotUsername(input.bot.username)),
            name: input.name,
            type: input.type,
            ownerTelegramId: TelegramId.create(input.ownerTelegramId),
            bot: { id: input.bot.id, username: input.bot.username },
            address: input.address,
            location: input.location
                ? Location.create(input.location.latitude, input.location.longitude)
                : undefined,
            delivery: {
                fee: Money.of(input.deliveryFee),
                freeFrom: optionalMoney(input.freeDeliveryFrom),
                minOrder: optionalMoney(input.minOrder),
            },
        })

        await this.businesses.insert(business, input.bot.token)
        return toShopOwnerDTO(business, this.clock.now())
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

export function optionalMoney(amount: number | undefined | null): Money | undefined {
    return amount === undefined || amount === null || amount === 0 ? undefined : Money.of(amount)
}
