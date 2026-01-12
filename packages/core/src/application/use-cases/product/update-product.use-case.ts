import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { Money } from "../../../domain/value-objects/money.js"
import { toProductDTO } from "../../dtos/product.dto.js"

import type { ProductDTO, UpdateProductInput } from "../../dtos/product.dto.js"
import type { ProductRepository } from "../../ports/product-repository.js"

export class UpdateProductUseCase {
    constructor(private readonly productRepository: ProductRepository) {}

    async execute(id: string, input: UpdateProductInput): Promise<ProductDTO> {
        const product = await this.productRepository.findById(id)

        if (!product) {
            throw EntityNotFoundError.product(id)
        }

        if (input.name || input.description || input.category) {
            product.updateDetails(
                input.name ?? product.name,
                input.description ?? product.description,
                input.category ?? product.category,
            )
        }

        if (input.price) {
            const price = Money.create(input.price.amount, input.price.currency)
            product.updatePrice(price)
        }

        if (input.imageUrl !== undefined) {
            product.updateImage(input.imageUrl)
        }

        await this.productRepository.save(product)

        return toProductDTO(product)
    }
}
