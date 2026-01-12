import { Module } from "@nestjs/common"

import { MongoDbCustomerRepository } from "../../infrastructure/repositories/mongodb-customer.repository.js"

import { CustomerController } from "./customer.controller.js"
import { CustomerService } from "./customer.service.js"

@Module({
    controllers: [CustomerController],
    providers: [CustomerService, MongoDbCustomerRepository],
    exports: [CustomerService, MongoDbCustomerRepository],
})
export class CustomerModule {}
