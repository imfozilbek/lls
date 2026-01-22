import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toCourierDTO } from "../../dtos/courier.dto.js"

import type { CourierDTO } from "../../dtos/courier.dto.js"
import type { CourierRepository } from "../../ports/courier-repository.js"

export class GetCourierByTelegramIdUseCase {
    constructor(private readonly courierRepository: CourierRepository) {}

    async execute(telegramId: number): Promise<CourierDTO> {
        const courier = await this.courierRepository.findByTelegramId(telegramId)

        if (!courier) {
            throw EntityNotFoundError.courierByTelegramId(telegramId)
        }

        return toCourierDTO(courier)
    }
}
