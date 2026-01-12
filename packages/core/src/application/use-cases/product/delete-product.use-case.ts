import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"

import type { ProductRepository } from "../../ports/product-repository.js"

export class DeleteProductUseCase {
    constructor(private readonly productRepository: ProductRepository) {}

    async execute(id: string): Promise<void> {
        const product = await this.productRepository.findById(id)

        if (!product) {
            throw EntityNotFoundError.product(id)
        }

        await this.productRepository.delete(id)
    }
}
