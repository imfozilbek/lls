import { GetOrCreateCustomerUseCase, UpdateCustomerUseCase } from "@lls/core"
import { Injectable } from "@nestjs/common"

import { MongoDbCustomerRepository } from "../../infrastructure/repositories/mongodb-customer.repository.js"

import type { CustomerDTO, TelegramUserData, UpdateCustomerInput } from "@lls/core"

@Injectable()
export class CustomerService {
    private readonly getOrCreateCustomer: GetOrCreateCustomerUseCase
    private readonly updateCustomer: UpdateCustomerUseCase

    constructor(private readonly repository: MongoDbCustomerRepository) {
        this.getOrCreateCustomer = new GetOrCreateCustomerUseCase(repository)
        this.updateCustomer = new UpdateCustomerUseCase(repository)
    }

    async getOrCreate(telegramData: TelegramUserData): Promise<CustomerDTO> {
        return this.getOrCreateCustomer.execute(telegramData)
    }

    async update(id: string, input: UpdateCustomerInput): Promise<CustomerDTO> {
        return this.updateCustomer.execute(id, input)
    }
}
