import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { Address } from "../../../domain/value-objects/address.js"
import { toBusinessDTO } from "../../dtos/business.dto.js"

import type { BusinessDTO, UpdateBusinessInput } from "../../dtos/business.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"

export class UpdateBusinessUseCase {
    constructor(private readonly businessRepository: BusinessRepository) {}

    async execute(id: string, input: UpdateBusinessInput): Promise<BusinessDTO> {
        const business = await this.businessRepository.findById(id)

        if (!business) {
            throw EntityNotFoundError.business(id)
        }

        if (input.name) {
            business.updateName(input.name)
        }

        if (input.address) {
            const address = Address.create(
                input.address.street,
                input.address.city,
                input.address.latitude !== undefined && input.address.longitude !== undefined
                    ? { latitude: input.address.latitude, longitude: input.address.longitude }
                    : undefined,
            )
            business.updateAddress(address)
        }

        await this.businessRepository.save(business)

        return toBusinessDTO(business)
    }
}
