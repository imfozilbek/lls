import { PayoutCardBook } from "../../../domain/entities/payout-card-book.js"
import { PayoutCard } from "../../../domain/value-objects/payout-card.js"
import { toPayoutCardsDTO } from "../../dtos/shop.dto.js"
import { requireOwnedBusiness } from "../shared.js"

import type { Business } from "../../../domain/entities/business.js"
import type { PayoutCardsDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { PayoutCardRepository } from "../../ports/payout-card-repository.js"

export interface PayoutCardDeps {
    businesses: BusinessRepository
    cards: PayoutCardRepository
    clock: Clock
}

interface OwnerInput {
    actorTelegramId: number
    businessId: string
}

async function openBook(
    deps: PayoutCardDeps,
    input: OwnerInput,
): Promise<{ business: Business; book: PayoutCardBook }> {
    const business = await requireOwnedBusiness(
        deps.businesses,
        input.businessId,
        input.actorTelegramId,
    )
    const book = new PayoutCardBook(business, await deps.cards.listByBusiness(business.id))
    return { business, book }
}

/** «Kartalar» in "Мой магазин": every card of the shop and the one customers are shown. */
export class ListPayoutCardsUseCase {
    constructor(private readonly deps: PayoutCardDeps) {}

    async execute(input: OwnerInput): Promise<PayoutCardsDTO> {
        const { business, book } = await openBook(this.deps, input)
        return toPayoutCardsDTO(book, business)
    }
}

export class AddPayoutCardUseCase {
    constructor(private readonly deps: PayoutCardDeps) {}

    async execute(input: OwnerInput & { number: string; holder: string }): Promise<PayoutCardsDTO> {
        const { business, book } = await openBook(this.deps, input)
        const firstCard = business.paymentCardId === undefined
        const saved = book.add({
            id: crypto.randomUUID(),
            card: PayoutCard.create(input.number, input.holder),
            now: this.deps.clock.now(),
        })
        // The first card becomes the payment card: the shop and the card go in one write.
        if (firstCard) {
            await this.deps.businesses.saveWithCard(business, saved)
        } else {
            await this.deps.cards.insert(business.id, saved)
        }
        return toPayoutCardsDTO(book, business)
    }
}

/** Customers are shown this card from the next order on; earlier orders keep theirs. */
export class ChoosePaymentCardUseCase {
    constructor(private readonly deps: PayoutCardDeps) {}

    async execute(input: OwnerInput & { cardId: string }): Promise<PayoutCardsDTO> {
        const { business, book } = await openBook(this.deps, input)
        book.choose(input.cardId)
        await this.deps.businesses.save(business)
        return toPayoutCardsDTO(book, business)
    }
}

export class RemovePayoutCardUseCase {
    constructor(private readonly deps: PayoutCardDeps) {}

    async execute(input: OwnerInput & { cardId: string }): Promise<PayoutCardsDTO> {
        const { business, book } = await openBook(this.deps, input)
        const removed = book.remove(input.cardId)
        await this.deps.cards.delete(business.id, removed.id)
        return toPayoutCardsDTO(book, business)
    }
}
