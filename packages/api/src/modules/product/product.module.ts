import { Module } from "@nestjs/common"

import { BusinessAuthGuard } from "../../common/guards/business-auth.guard.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"
import { MongoDbProductRepository } from "../../infrastructure/repositories/mongodb-product.repository.js"

import { ProductController } from "./product.controller.js"
import { ProductService } from "./product.service.js"

@Module({
    controllers: [ProductController],
    providers: [
        ProductService,
        MongoDbProductRepository,
        MongoDbBusinessRepository,
        MongoDbOrderRepository,
        BusinessAuthGuard,
    ],
    exports: [ProductService, MongoDbProductRepository],
})
export class ProductModule {}
