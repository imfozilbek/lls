import { Module } from "@nestjs/common"

import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbCustomerRepository } from "../../infrastructure/repositories/mongodb-customer.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"

import { OrderController } from "./order.controller.js"
import { OrderService } from "./order.service.js"

@Module({
    controllers: [OrderController],
    providers: [
        OrderService,
        MongoDbOrderRepository,
        MongoDbCustomerRepository,
        MongoDbBusinessRepository,
    ],
    exports: [OrderService, MongoDbOrderRepository],
})
export class OrderModule {}
