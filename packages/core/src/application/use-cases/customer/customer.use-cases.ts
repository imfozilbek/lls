import { Customer } from "../../../domain/entities/customer.js"
import { LANGUAGES, languageFromTelegram } from "../../../domain/enums/language.js"
import { requireOneOf } from "../../../domain/shared/guards.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { toCustomerDTO } from "../../dtos/customer.dto.js"
import { displayNameOf } from "../../dtos/telegram-user.js"

import type { CustomerDTO } from "../../dtos/customer.dto.js"
import type { TelegramUser } from "../../dtos/telegram-user.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"

/** Finds the customer by Telegram id or registers them. Keeps the name in sync with Telegram. */
export async function resolveCustomer(
    customers: CustomerRepository,
    user: TelegramUser,
): Promise<Customer> {
    const name = displayNameOf(user)
    const existing = await customers.findByTelegramId(user.id)
    if (existing) {
        if (existing.name !== name) {
            existing.rename(name)
            await customers.save(existing)
        }
        return existing
    }
    const customer = Customer.register({
        id: crypto.randomUUID(),
        telegramId: TelegramId.create(user.id),
        name,
        language: languageFromTelegram(user.languageCode),
    })
    await customers.save(customer)
    return customer
}

export class ResolveCustomerUseCase {
    constructor(private readonly customers: CustomerRepository) {}

    async execute(user: TelegramUser): Promise<CustomerDTO> {
        return toCustomerDTO(await resolveCustomer(this.customers, user))
    }
}

export interface UpdateCustomerInput {
    user: TelegramUser
    language?: string
    /** Only from a Telegram `contact` message whose user_id matches the sender. */
    phone?: string
}

export class UpdateCustomerUseCase {
    constructor(private readonly customers: CustomerRepository) {}

    async execute(input: UpdateCustomerInput): Promise<CustomerDTO> {
        const customer = await resolveCustomer(this.customers, input.user)
        if (input.language !== undefined) {
            customer.setLanguage(requireOneOf("language", input.language, LANGUAGES))
        }
        if (input.phone !== undefined) {
            customer.setPhone(Phone.create(input.phone))
        }
        await this.customers.save(customer)
        return toCustomerDTO(customer)
    }
}
