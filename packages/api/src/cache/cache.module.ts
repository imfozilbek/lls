import { Global, Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Redis } from "ioredis"

import { REDIS_CLIENT } from "./cache.constants.js"
import { CacheService } from "./cache.service.js"

import type { AppConfig } from "../config/configuration.js"

@Global()
@Module({
    providers: [
        {
            provide: REDIS_CLIENT,
            useFactory: (configService: ConfigService<AppConfig>): Redis => {
                const redisUrl = configService.get("redisUrl")
                return new Redis(redisUrl as string)
            },
            inject: [ConfigService],
        },
        CacheService,
    ],
    exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
