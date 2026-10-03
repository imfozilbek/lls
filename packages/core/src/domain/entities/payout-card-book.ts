import { BusinessRuleViolationError } from "../errors/business-rule.error.js"
import { EntityNotFoundError } from "../errors/not-found.error.js"

import type { Business } from "./business.js"
import type { PayoutCard } from "../value-objects/payout-card.js"

/** As many cards as a shop really uses, and a cap that keeps the owner's list one screen. */
export const MAX_PAYOUT_CARDS = 20

/** One of the shop's cards, kept in its list. */
export interface SavedPayoutCard {
    id: string
    card: PayoutCard
    createdAt: Date
}

/**
 * The shop's cards for customers' transfers. The owner adds as many as needed and chooses which
 * one customers are shown (the payment card); it can be switched at any moment. The payment card
 * cannot be removed: without it the shop takes no orders.
 */
export class PayoutCardBook {
    private readonly cards: SavedPayoutCard[]

    constructor(
        private readonly business: Business,
        cards: readonly SavedPayoutCard[],
    ) {
        this.cards = [...cards]
    }

    list(): SavedPayoutCard[] {
        return [...this.cards]
    }

    /** A new card. The shop's first card becomes the payment card at once. */
    add(input: { id: string; card: PayoutCard; now: Date }): SavedPayoutCard {
        if (this.cards.length >= MAX_PAYOUT_CARDS) {
            throw BusinessRuleViolationError.payoutCardLimit(MAX_PAYOUT_CARDS)
        }
        if (this.cards.some((saved) => saved.card.number === input.card.number)) {
            throw BusinessRuleViolationError.cardExists()
        }
        const saved = { id: input.id, card: input.card, createdAt: input.now }
        this.cards.push(saved)
        if (this.business.paymentCardId === undefined) {
            this.business.usePaymentCard(saved.id, saved.card)
        }
        return saved
    }

    /** Customers are shown this card from the next order on. */
    choose(id: string): void {
        const saved = this.find(id)
        this.business.usePaymentCard(saved.id, saved.card)
    }

    remove(id: string): SavedPayoutCard {
        const saved = this.find(id)
        if (this.business.paymentCardId === id) {
            throw BusinessRuleViolationError.paymentCardInUse(id)
        }
        this.cards.splice(this.cards.indexOf(saved), 1)
        return saved
    }

    private find(id: string): SavedPayoutCard {
        const saved = this.cards.find((card) => card.id === id)
        if (!saved) {
            throw EntityNotFoundError.payoutCard(id)
        }
        return saved
    }
}
