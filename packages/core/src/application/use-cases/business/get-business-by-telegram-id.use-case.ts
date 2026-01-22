import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toBusinessDTO } from "../../dtos/business.dto.js"

import type { BusinessDTO } from "../../dtos/business.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"

export class GetBusinessByTelegramIdUseCase {
    constructor(private readonly businessRepository: BusinessRepository) {}

    async execute(telegramId: number): Promise<BusinessDTO> {
        const business = await this.businessRepository.findByTelegramId(telegramId)

        if (!business) {
            throw EntityNotFoundError.businessByTelegramId(telegramId)
        }

        return toBusinessDTO(business)
    }
}
