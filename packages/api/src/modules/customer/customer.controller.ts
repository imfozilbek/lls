import { Body, Controller, Param, Patch, Post } from "@nestjs/common"

import { CustomerService } from "./customer.service.js"

import type { CustomerDTO, TelegramUserData, UpdateCustomerInput } from "@lls/core"

@Controller("customers")
export class CustomerController {
    constructor(private readonly service: CustomerService) {}

    @Post("telegram")
    async getOrCreate(@Body() telegramData: TelegramUserData): Promise<CustomerDTO> {
        return this.service.getOrCreate(telegramData)
    }

    @Patch(":id")
    async update(
        @Param("id") id: string,
        @Body() input: UpdateCustomerInput,
    ): Promise<CustomerDTO> {
        return this.service.update(id, input)
    }
}
