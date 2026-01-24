import {
    CreateProductUseCase,
    DeleteProductUseCase,
    ListProductsUseCase,
    ToggleProductAvailabilityUseCase,
    UpdateProductUseCase,
} from "@lls/core"
import { Injectable } from "@nestjs/common"

import { paginate, PaginatedResult, PaginationDto } from "../../common/dto/pagination.dto.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbProductRepository } from "../../infrastructure/repositories/mongodb-product.repository.js"

import type { CreateProductInput, ProductDTO, UpdateProductInput } from "@lls/core"

@Injectable()
export class ProductService {
    private readonly listProducts: ListProductsUseCase
    private readonly createProduct: CreateProductUseCase
    private readonly updateProduct: UpdateProductUseCase
    private readonly deleteProduct: DeleteProductUseCase
    private readonly toggleAvailability: ToggleProductAvailabilityUseCase

    constructor(
        private readonly productRepository: MongoDbProductRepository,
        private readonly businessRepository: MongoDbBusinessRepository,
    ) {
        this.listProducts = new ListProductsUseCase(productRepository)
        this.createProduct = new CreateProductUseCase(productRepository, businessRepository)
        this.updateProduct = new UpdateProductUseCase(productRepository)
        this.deleteProduct = new DeleteProductUseCase(productRepository)
        this.toggleAvailability = new ToggleProductAvailabilityUseCase(productRepository)
    }

    async listByBusiness(
        businessId: string,
        pagination?: PaginationDto,
    ): Promise<PaginatedResult<ProductDTO>> {
        const page = pagination?.page ?? 1
        const limit = pagination?.limit ?? 20

        const all = await this.listProducts.execute({ businessId })
        const total = all.length
        const start = (page - 1) * limit
        const items = all.slice(start, start + limit)

        return paginate(items, total, page, limit)
    }

    async create(input: CreateProductInput): Promise<ProductDTO> {
        return this.createProduct.execute(input)
    }

    async update(id: string, input: UpdateProductInput): Promise<ProductDTO> {
        return this.updateProduct.execute(id, input)
    }

    async delete(id: string): Promise<void> {
        return this.deleteProduct.execute(id)
    }

    async toggle(id: string): Promise<ProductDTO> {
        return this.toggleAvailability.execute(id)
    }
}
