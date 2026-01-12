import { Product } from "../../../domain/entities/product.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { Money } from "../../../domain/value-objects/money.js"
import { toProductDTO } from "../../dtos/product.dto.js"

import type { ProductDTO, CreateProductInput } from "../../dtos/product.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { ProductRepository } from "../../ports/product-repository.js"


export class CreateProductUseCase {
    constructor(
        private readonly productRepository: ProductRepository,
        private readonly businessRepository: BusinessRepository,
    ) {}

    async execute(input: CreateProductInput): Promise<ProductDTO> {
        const business = await this.businessRepository.findById(input.businessId)

        if (!business) {
            throw EntityNotFoundError.business(input.businessId)
        }

        const price = Money.create(input.price.amount, input.price.currency)

        const product = Product.create({
            id: crypto.randomUUID(),
            businessId: input.businessId,
            name: input.name,
            description: input.description,
            price,
            category: input.category,
            imageUrl: input.imageUrl,
        })

        await this.productRepository.save(product)

        return toProductDTO(product)
    }
}
