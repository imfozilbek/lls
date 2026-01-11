import { Customer } from "../../domain/entities/customer.js"

export interface CustomerRepository {
    findById(id: string): Promise<Customer | null>
    findByTelegramId(telegramId: number): Promise<Customer | null>
    save(customer: Customer): Promise<void>
    delete(id: string): Promise<void>
}
