import { Module } from "@nestjs/common"

import { MongoDbAnalyticsRepository } from "../../infrastructure/repositories/mongodb-analytics.repository.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"

import { AnalyticsController } from "./analytics.controller.js"
import { AnalyticsService } from "./analytics.service.js"

@Module({
    controllers: [AnalyticsController],
    providers: [AnalyticsService, MongoDbAnalyticsRepository, MongoDbBusinessRepository],
    exports: [AnalyticsService],
})
export class AnalyticsModule {}
