import { Business } from "../../../domain/entities/business.js"
import { Address } from "../../../domain/value-objects/address.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { toBusinessDTO } from "../../dtos/business.dto.js"

import type { BusinessDTO, CreateBusinessInput } from "../../dtos/business.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"

export class CreateBusinessUseCase {
    constructor(private readonly businessRepository: BusinessRepository) {}

    async execute(input: CreateBusinessInput): Promise<BusinessDTO> {
        const address = Address.create(
            input.address.street,
            input.address.city,
            input.address.latitude !== undefined && input.address.longitude !== undefined
                ? { latitude: input.address.latitude, longitude: input.address.longitude }
                : undefined,
        )

        const telegramId = TelegramId.create(input.telegramId)

        const business = Business.create({
            id: crypto.randomUUID(),
            name: input.name,
            type: input.type,
            address,
            telegramId,
        })

        await this.businessRepository.save(business)

        return toBusinessDTO(business)
    }
}
