import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toProductDTO } from "../../dtos/product.dto.js"

import type { ProductDTO } from "../../dtos/product.dto.js"
import type { ProductRepository } from "../../ports/product-repository.js"

export class ToggleProductAvailabilityUseCase {
    constructor(private readonly productRepository: ProductRepository) {}

    async execute(id: string): Promise<ProductDTO> {
        const product = await this.productRepository.findById(id)

        if (!product) {
            throw EntityNotFoundError.product(id)
        }

        if (product.isAvailable) {
            product.markUnavailable()
        } else {
            product.markAvailable()
        }

        await this.productRepository.save(product)

        return toProductDTO(product)
    }
}
