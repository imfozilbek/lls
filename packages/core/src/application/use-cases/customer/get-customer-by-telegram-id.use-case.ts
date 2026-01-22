import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toCustomerDTO } from "../../dtos/customer.dto.js"

import type { CustomerDTO } from "../../dtos/customer.dto.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"

export class GetCustomerByTelegramIdUseCase {
    constructor(private readonly customerRepository: CustomerRepository) {}

    async execute(telegramId: number): Promise<CustomerDTO> {
        const customer = await this.customerRepository.findByTelegramId(telegramId)

        if (!customer) {
            throw EntityNotFoundError.customerByTelegramId(telegramId)
        }

        return toCustomerDTO(customer)
    }
}
