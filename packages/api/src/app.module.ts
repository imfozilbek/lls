import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core"

import { AppController } from "./app.controller.js"
import { CacheModule } from "./cache/cache.module.js"
import { AllExceptionsFilter, DomainExceptionFilter } from "./common/filters/index.js"
import { LoggingInterceptor, TransformInterceptor } from "./common/interceptors/index.js"
import { configuration } from "./config/configuration.js"
import { DatabaseModule } from "./database/database.module.js"
import { GatewayModule } from "./gateway/gateway.module.js"
import { AnalyticsModule } from "./modules/analytics/analytics.module.js"
import { BusinessModule } from "./modules/business/business.module.js"
import { CourierModule } from "./modules/courier/courier.module.js"
import { CustomerModule } from "./modules/customer/customer.module.js"
import { OrderModule } from "./modules/order/order.module.js"
import { ProductModule } from "./modules/product/product.module.js"

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        DatabaseModule,
        CacheModule,
        GatewayModule,
        AnalyticsModule,
        BusinessModule,
        ProductModule,
        OrderModule,
        CourierModule,
        CustomerModule,
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
    ],
})
export class AppModule {}
