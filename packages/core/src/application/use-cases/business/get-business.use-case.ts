import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toBusinessDTO } from "../../dtos/business.dto.js"

import type { BusinessDTO } from "../../dtos/business.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"

export class GetBusinessUseCase {
    constructor(private readonly businessRepository: BusinessRepository) {}

    async execute(id: string): Promise<BusinessDTO> {
        const business = await this.businessRepository.findById(id)

        if (!business) {
            throw EntityNotFoundError.business(id)
        }

        return toBusinessDTO(business)
    }
}
