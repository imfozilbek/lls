import { Customer } from "../../../domain/entities/customer.js"
import { Address } from "../../../domain/value-objects/address.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { toCustomerDTO } from "../../dtos/customer.dto.js"

import type { CustomerDTO, TelegramUserData } from "../../dtos/customer.dto.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"


export class GetOrCreateCustomerUseCase {
    constructor(private readonly customerRepository: CustomerRepository) {}

    async execute(data: TelegramUserData): Promise<CustomerDTO> {
        const existing = await this.customerRepository.findByTelegramId(data.telegramId)

        if (existing) {
            return toCustomerDTO(existing)
        }

        const name = data.lastName
            ? `${data.firstName} ${data.lastName}`
            : data.firstName

        const customer = Customer.create({
            id: crypto.randomUUID(),
            telegramId: TelegramId.create(data.telegramId),
            name,
            phone: Phone.create("+998900000000"),
            address: Address.create("Not set", "Tashkent"),
        })

        await this.customerRepository.save(customer)

        return toCustomerDTO(customer)
    }
}
