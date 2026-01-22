import { Module } from "@nestjs/common"

import { TelegramAuthService } from "../../common/services/telegram-auth.service.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"

import { BusinessController } from "./business.controller.js"
import { BusinessService } from "./business.service.js"

@Module({
    controllers: [BusinessController],
    providers: [BusinessService, MongoDbBusinessRepository, TelegramAuthService],
    exports: [BusinessService, MongoDbBusinessRepository],
})
export class BusinessModule {}
