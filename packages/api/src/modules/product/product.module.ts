import { Module } from "@nestjs/common"

import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbProductRepository } from "../../infrastructure/repositories/mongodb-product.repository.js"

import { ProductController } from "./product.controller.js"
import { ProductService } from "./product.service.js"

@Module({
    controllers: [ProductController],
    providers: [ProductService, MongoDbProductRepository, MongoDbBusinessRepository],
    exports: [ProductService, MongoDbProductRepository],
})
export class ProductModule {}
