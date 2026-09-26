import type { Customer } from "../../domain/entities/customer.js"
import type { Language } from "../../domain/enums/language.js"

export interface CustomerDTO {
    id: string
    telegramId: number
    name: string
    phone?: string
    language: Language
}

export function toCustomerDTO(customer: Customer): CustomerDTO {
    return {
        id: customer.id,
        telegramId: customer.telegramId.value,
        name: customer.name,
        phone: customer.phone?.number,
        language: customer.language,
    }
}
