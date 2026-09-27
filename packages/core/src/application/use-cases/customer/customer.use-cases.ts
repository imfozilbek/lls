import { Customer } from "../../../domain/entities/customer.js"
import { LANGUAGES, languageFromTelegram } from "../../../domain/enums/language.js"
import { requireOneOf } from "../../../domain/shared/guards.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { toCustomerDTO } from "../../dtos/customer.dto.js"
import { displayNameOf } from "../../dtos/telegram-user.js"

import type { CustomerDTO } from "../../dtos/customer.dto.js"
import type { IdentityScope } from "../../dtos/identity-scope.js"
import type { TelegramUser } from "../../dtos/telegram-user.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"

/**
 * Finds the customer by Telegram id or registers them. A trusted identity keeps the name in sync
 * with Telegram; a shop-signed one never renames: its owner could sign any user id.
 */
export async function resolveCustomer(
    customers: CustomerRepository,
    user: TelegramUser,
    scope: IdentityScope,
): Promise<Customer> {
    const name = displayNameOf(user)
    const existing = await customers.findByTelegramId(user.id)
    if (existing) {
        if (scope.kind === "trusted" && existing.name !== name) {
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

/** The phone is shown to a shop only after the customer sent it to that shop. */
export async function phoneVisibleIn(
    customers: CustomerRepository,
    customer: Customer,
    scope: IdentityScope,
): Promise<boolean> {
    if (!customer.hasPhone()) {
        return false
    }
    return scope.kind === "trusted" || customers.hasSharedPhoneWith(customer.id, scope.businessId)
}

async function customerView(
    customers: CustomerRepository,
    customer: Customer,
    scope: IdentityScope,
): Promise<CustomerDTO> {
    const dto = toCustomerDTO(customer)
    return (await phoneVisibleIn(customers, customer, scope)) ? dto : { ...dto, phone: undefined }
}

export class ResolveCustomerUseCase {
    constructor(private readonly customers: CustomerRepository) {}

    async execute(user: TelegramUser, scope: IdentityScope): Promise<CustomerDTO> {
        const customer = await resolveCustomer(this.customers, user, scope)
        return customerView(this.customers, customer, scope)
    }
}

export interface UpdateCustomerInput {
    user: TelegramUser
    scope: IdentityScope
    language?: string
}

export class UpdateCustomerUseCase {
    constructor(private readonly customers: CustomerRepository) {}

    async execute(input: UpdateCustomerInput): Promise<CustomerDTO> {
        const customer = await resolveCustomer(this.customers, input.user, input.scope)
        if (input.language !== undefined) {
            customer.setLanguage(requireOneOf("language", input.language, LANGUAGES))
        }
        await this.customers.save(customer)
        return customerView(this.customers, customer, input.scope)
    }
}

export interface SaveContactInput {
    /** The sender of a Telegram `contact` message; only their own contact counts. */
    user: TelegramUser
    phone: string
    /** The shop whose bot received the contact; none for the LLS bot. */
    businessId?: string
    now: Date
}

/** A phone from a Telegram contact message: real, and shared with the bot that received it. */
export class SaveContactUseCase {
    constructor(private readonly customers: CustomerRepository) {}

    async execute(input: SaveContactInput): Promise<CustomerDTO> {
        const customer = await resolveCustomer(this.customers, input.user, { kind: "trusted" })
        customer.setPhone(Phone.create(input.phone))
        await this.customers.save(customer)
        if (input.businessId) {
            await this.customers.sharePhoneWith(customer.id, input.businessId, input.now)
        }
        return toCustomerDTO(customer)
    }
}
