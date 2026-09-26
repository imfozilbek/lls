import type { Customer } from "../../domain/entities/customer.js"

export interface CustomerRepository {
    findById(id: string): Promise<Customer | null>
    findByTelegramId(telegramId: number): Promise<Customer | null>
    save(customer: Customer): Promise<void>
    /** Remember that this customer ordered from this shop. Idempotent: keeps the first date. */
    linkToBusiness(customerId: string, businessId: string, at: Date): Promise<void>
}
