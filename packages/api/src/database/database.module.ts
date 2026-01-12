import { Global, Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { MongooseModule } from "@nestjs/mongoose"

import {
    Business,
    BusinessSchema,
    Courier,
    CourierSchema,
    Customer,
    CustomerSchema,
    Order,
    OrderSchema,
    Product,
    ProductSchema,
} from "./schemas/index.js"

import type { AppConfig } from "../config/configuration.js"

@Global()
@Module({
    imports: [
        MongooseModule.forRootAsync({
            useFactory: (configService: ConfigService<AppConfig>) => ({
                uri: configService.get("mongoUri"),
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forFeature([
            { name: Business.name, schema: BusinessSchema },
            { name: Product.name, schema: ProductSchema },
            { name: Customer.name, schema: CustomerSchema },
            { name: Courier.name, schema: CourierSchema },
            { name: Order.name, schema: OrderSchema },
        ]),
    ],
    exports: [MongooseModule],
})
export class DatabaseModule {}
