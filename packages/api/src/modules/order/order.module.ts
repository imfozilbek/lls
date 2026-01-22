import { Module } from "@nestjs/common"

import { BusinessAuthGuard } from "../../common/guards/business-auth.guard.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbCustomerRepository } from "../../infrastructure/repositories/mongodb-customer.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"
import { MongoDbProductRepository } from "../../infrastructure/repositories/mongodb-product.repository.js"

import { OrderController } from "./order.controller.js"
import { OrderService } from "./order.service.js"

@Module({
    controllers: [OrderController],
    providers: [
        OrderService,
        MongoDbOrderRepository,
        MongoDbCustomerRepository,
        MongoDbBusinessRepository,
        MongoDbProductRepository,
        BusinessAuthGuard,
    ],
    exports: [OrderService, MongoDbOrderRepository],
})
export class OrderModule {}
