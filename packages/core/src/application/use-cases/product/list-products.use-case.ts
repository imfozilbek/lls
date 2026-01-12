import { toProductDTO } from "../../dtos/product.dto.js"

import type { ProductDTO } from "../../dtos/product.dto.js"
import type { ProductRepository } from "../../ports/product-repository.js"

export interface ListProductsFilter {
    businessId: string
    category?: string
    availableOnly?: boolean
}

export class ListProductsUseCase {
    constructor(private readonly productRepository: ProductRepository) {}

    async execute(filter: ListProductsFilter): Promise<ProductDTO[]> {
        let products

        if (filter.category) {
            products = await this.productRepository.findByCategory(
                filter.businessId,
                filter.category,
            )
        } else if (filter.availableOnly) {
            products = await this.productRepository.findAvailableByBusinessId(filter.businessId)
        } else {
            products = await this.productRepository.findByBusinessId(filter.businessId)
        }

        return products.map(toProductDTO)
    }
}
