import type { Customer } from "../../domain/entities/customer.js"

export interface CustomerRepository {
    findById(id: string): Promise<Customer | null>
    findByTelegramId(telegramId: number): Promise<Customer | null>
    save(customer: Customer): Promise<void>
    /** The customer sent their phone to this shop (its bot, or an order through the showcase). */
    hasSharedPhoneWith(customerId: string, businessId: string): Promise<boolean>
    /** Idempotent: keeps the first date. */
    sharePhoneWith(customerId: string, businessId: string, at: Date): Promise<void>
    /** Remember that this customer ordered from this shop. Idempotent: keeps the first date. */
    linkToBusiness(customerId: string, businessId: string, at: Date): Promise<void>
}
