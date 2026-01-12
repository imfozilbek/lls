import { Module } from "@nestjs/common"

import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"

import { BusinessController } from "./business.controller.js"
import { BusinessService } from "./business.service.js"

@Module({
    controllers: [BusinessController],
    providers: [BusinessService, MongoDbBusinessRepository],
    exports: [BusinessService, MongoDbBusinessRepository],
})
export class BusinessModule {}
