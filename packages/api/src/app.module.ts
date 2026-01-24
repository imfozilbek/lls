import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core"
import { ThrottlerModule } from "@nestjs/throttler"

import { AppController } from "./app.controller.js"
import { CacheModule } from "./cache/cache.module.js"
import { AllExceptionsFilter, DomainExceptionFilter } from "./common/filters/index.js"
import { LoggingInterceptor, TransformInterceptor } from "./common/interceptors/index.js"
import { configuration } from "./config/configuration.js"
import { DatabaseModule } from "./database/database.module.js"
import { GatewayModule } from "./gateway/gateway.module.js"
import { RateLimiterGuard } from "./middleware/rate-limiter.js"
import { AnalyticsModule } from "./modules/analytics/analytics.module.js"
import { BusinessModule } from "./modules/business/business.module.js"
import { CourierModule } from "./modules/courier/courier.module.js"
import { CustomerModule } from "./modules/customer/customer.module.js"
import { OrderModule } from "./modules/order/order.module.js"
import { ProductModule } from "./modules/product/product.module.js"
import { NotificationsModule } from "./notifications/notifications.module.js"

const config = configuration()

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        // Security: Rate limiting to prevent abuse
        ThrottlerModule.forRoot([
            {
                ttl: config.rateLimitTtl,
                limit: config.rateLimitMax,
            },
        ]),
        DatabaseModule,
        CacheModule,
        GatewayModule,
        AnalyticsModule,
        BusinessModule,
        ProductModule,
        OrderModule,
        CourierModule,
        CustomerModule,
        NotificationsModule,
    ],
    controllers: [AppController],
    providers: [
        {
            provide: APP_FILTER,
            useClass: AllExceptionsFilter,
        },
        {
            provide: APP_FILTER,
            useClass: DomainExceptionFilter,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformInterceptor,
        },
        // Security: Global rate limiting guard
        {
            provide: APP_GUARD,
            useClass: RateLimiterGuard,
        },
    ],
})
export class AppModule {}
