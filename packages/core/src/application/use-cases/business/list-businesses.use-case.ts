import { toBusinessDTO } from "../../dtos/business.dto.js"

import type { BusinessDTO, BusinessFilter } from "../../dtos/business.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"


export class ListBusinessesUseCase {
    constructor(private readonly businessRepository: BusinessRepository) {}

    async execute(filter?: BusinessFilter): Promise<BusinessDTO[]> {
        let businesses

        if (filter?.type) {
            businesses = await this.businessRepository.findByType(filter.type)
        } else if (filter?.isActive === true) {
            businesses = await this.businessRepository.findActive()
        } else {
            businesses = await this.businessRepository.findAll()
        }

        if (filter?.isActive !== undefined && !filter.type) {
            businesses = businesses.filter((b) => b.isActive === filter.isActive)
        }

        return businesses.map(toBusinessDTO)
    }
}
