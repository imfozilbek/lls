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
    UseGuards,
} from "@nestjs/common"

import { BusinessAuthMode } from "../../common/decorators/index.js"
import { BusinessAuthGuard, TelegramAuthGuard } from "../../common/guards/index.js"

import { CreateProductDto, UpdateProductDto } from "./dto/index.js"
import { ProductService } from "./product.service.js"

import type { ProductDTO } from "@lls/core"

@Controller()
export class ProductController {
    constructor(private readonly service: ProductService) {}

    @Get("businesses/:businessId/products")
    async listByBusiness(@Param("businessId") businessId: string): Promise<ProductDTO[]> {
        return this.service.listByBusiness(businessId)
    }

    @Post("businesses/:businessId/products")
    @UseGuards(TelegramAuthGuard, BusinessAuthGuard)
    async create(
        @Param("businessId") businessId: string,
        @Body() input: CreateProductDto,
    ): Promise<ProductDTO> {
        return this.service.create({
            businessId,
            name: input.name,
            description: input.description || "",
            price: input.price,
            category: input.category || "",
            imageUrl: input.imageUrl,
        })
    }

    @Patch("products/:id")
    @UseGuards(TelegramAuthGuard, BusinessAuthGuard)
    @BusinessAuthMode("product")
    async update(@Param("id") id: string, @Body() input: UpdateProductDto): Promise<ProductDTO> {
        return this.service.update(id, input)
    }

    @Delete("products/:id")
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(TelegramAuthGuard, BusinessAuthGuard)
    @BusinessAuthMode("product")
    async delete(@Param("id") id: string): Promise<void> {
        return this.service.delete(id)
    }

    @Patch("products/:id/availability")
    @UseGuards(TelegramAuthGuard, BusinessAuthGuard)
    @BusinessAuthMode("product")
    async toggleAvailability(@Param("id") id: string): Promise<ProductDTO> {
        return this.service.toggle(id)
    }
}
