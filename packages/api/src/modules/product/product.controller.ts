import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
} from "@nestjs/common"

import { ProductService } from "./product.service.js"

import type { CreateProductInput, ProductDTO, UpdateProductInput } from "@lls/core"

@Controller()
export class ProductController {
    constructor(private readonly service: ProductService) {}

    @Get("businesses/:businessId/products")
    async listByBusiness(@Param("businessId") businessId: string): Promise<ProductDTO[]> {
        return this.service.listByBusiness(businessId)
    }

    @Post("businesses/:businessId/products")
    async create(
        @Param("businessId") businessId: string,
        @Body() input: Omit<CreateProductInput, "businessId">,
    ): Promise<ProductDTO> {
        return this.service.create({ ...input, businessId })
    }

    @Patch("products/:id")
    async update(@Param("id") id: string, @Body() input: UpdateProductInput): Promise<ProductDTO> {
        return this.service.update(id, input)
    }

    @Delete("products/:id")
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param("id") id: string): Promise<void> {
        return this.service.delete(id)
    }

    @Patch("products/:id/availability")
    async toggleAvailability(@Param("id") id: string): Promise<ProductDTO> {
        return this.service.toggle(id)
    }
}
