import type { Customer } from "../../domain/entities/customer.js"

export interface CustomerRepository {
    findById(id: string): Promise<Customer | null>
    findByTelegramId(telegramId: number): Promise<Customer | null>
    /** Several people at once (the admin's list of shop owners): one query, unknown ids skipped. */
    findManyByTelegramIds(telegramIds: readonly number[]): Promise<Customer[]>
    save(customer: Customer): Promise<void>
    /**
     * Stores a new customer unless one with this Telegram id already exists, and returns the
     * stored one. Two first requests of the same person at once end with one customer.
     */
    register(customer: Customer): Promise<Customer>
    /** The customer sent their phone to this shop (its bot, or an order through the showcase). */
    hasSharedPhoneWith(customerId: string, businessId: string): Promise<boolean>
    /** Idempotent: keeps the first date. */
    sharePhoneWith(customerId: string, businessId: string, at: Date): Promise<void>
    /** Remember that this customer ordered from this shop. Idempotent: keeps the first date. */
    linkToBusiness(customerId: string, businessId: string, at: Date): Promise<void>
}
