import type { SavedPayoutCard } from "../../domain/entities/payout-card-book.js"

/** The shop's list of cards. The payment card itself is saved with the business. */
export interface PayoutCardRepository {
    /** Oldest first. */
    listByBusiness(businessId: string): Promise<SavedPayoutCard[]>
    insert(businessId: string, card: SavedPayoutCard): Promise<void>
    delete(businessId: string, id: string): Promise<void>
}
