import { Module } from "@nestjs/common"

import { MongoDbCourierRepository } from "../../infrastructure/repositories/mongodb-courier.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"

import { CourierController } from "./courier.controller.js"
import { CourierService } from "./courier.service.js"

@Module({
    controllers: [CourierController],
    providers: [CourierService, MongoDbOrderRepository, MongoDbCourierRepository],
    exports: [CourierService, MongoDbCourierRepository],
})
export class CourierModule {}
