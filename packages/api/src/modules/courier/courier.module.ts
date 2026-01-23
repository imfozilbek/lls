import { Module } from "@nestjs/common"

import { MongoDbCourierRepository } from "../../infrastructure/repositories/mongodb-courier.repository.js"
import { MongoDbCustomerRepository } from "../../infrastructure/repositories/mongodb-customer.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"
import { TelegramNotificationService } from "../../notifications/telegram-notification.service.js"

import { CourierController } from "./courier.controller.js"
import { CourierService } from "./courier.service.js"

@Module({
    controllers: [CourierController],
    providers: [
        CourierService,
        MongoDbOrderRepository,
        MongoDbCourierRepository,
        MongoDbCustomerRepository,
        TelegramNotificationService,
    ],
    exports: [CourierService, MongoDbCourierRepository],
})
export class CourierModule {}
