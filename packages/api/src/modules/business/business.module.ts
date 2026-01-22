import { Module } from "@nestjs/common"

import { BusinessAuthGuard } from "../../common/guards/business-auth.guard.js"
import { TelegramAuthService } from "../../common/services/telegram-auth.service.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"
import { MongoDbProductRepository } from "../../infrastructure/repositories/mongodb-product.repository.js"

import { BusinessController } from "./business.controller.js"
import { BusinessService } from "./business.service.js"

@Module({
    controllers: [BusinessController],
    providers: [
        BusinessService,
        MongoDbBusinessRepository,
        MongoDbProductRepository,
        MongoDbOrderRepository,
        TelegramAuthService,
        BusinessAuthGuard,
    ],
    exports: [BusinessService, MongoDbBusinessRepository],
})
export class BusinessModule {}
