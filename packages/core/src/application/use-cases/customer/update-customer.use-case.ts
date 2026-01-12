import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { Address } from "../../../domain/value-objects/address.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { toCustomerDTO } from "../../dtos/customer.dto.js"

import type { CustomerDTO, UpdateCustomerInput } from "../../dtos/customer.dto.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"

export class UpdateCustomerUseCase {
    constructor(private readonly customerRepository: CustomerRepository) {}

    async execute(id: string, input: UpdateCustomerInput): Promise<CustomerDTO> {
        const customer = await this.customerRepository.findById(id)

        if (!customer) {
            throw EntityNotFoundError.customer(id)
        }

        if (input.name || input.phone) {
            const phone = input.phone ? Phone.create(input.phone) : customer.phone

            customer.updateProfile(input.name ?? customer.name, phone)
        }

        if (input.address) {
            const address = Address.create(
                input.address.street,
                input.address.city,
                input.address.latitude !== undefined && input.address.longitude !== undefined
                    ? { latitude: input.address.latitude, longitude: input.address.longitude }
                    : undefined,
            )
            customer.updateAddress(address)
        }

        await this.customerRepository.save(customer)

        return toCustomerDTO(customer)
    }
}
