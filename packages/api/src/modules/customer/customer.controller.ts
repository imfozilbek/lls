import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"

import { TelegramUserDecorator } from "../../common/decorators/telegram-user.decorator.js"
import { TelegramAuthGuard } from "../../common/guards/telegram-auth.guard.js"

import { CustomerService } from "./customer.service.js"
import { UpdateCustomerDto } from "./dto/index.js"

import type { TelegramUser } from "../../common/guards/telegram-auth.guard.js"
import type { CustomerDTO, TelegramUserData } from "@lls/core"

@ApiTags("customers")
@Controller("customers")
export class CustomerController {
    constructor(private readonly service: CustomerService) {}

    @Post("telegram")
    async getOrCreate(@Body() telegramData: TelegramUserData): Promise<CustomerDTO> {
        return this.service.getOrCreate(telegramData)
    }

    @Get("me")
    @UseGuards(TelegramAuthGuard)
    async getMe(@TelegramUserDecorator() user: TelegramUser): Promise<CustomerDTO> {
        return this.service.getByTelegramId(user.id)
    }

    @Patch("me")
    @UseGuards(TelegramAuthGuard)
    async updateMe(
        @TelegramUserDecorator() user: TelegramUser,
        @Body() input: UpdateCustomerDto,
    ): Promise<CustomerDTO> {
        const customer = await this.service.getByTelegramId(user.id)
        return this.service.update(customer.id, input)
    }

    @Patch(":id")
    @UseGuards(TelegramAuthGuard)
    async update(@Param("id") id: string, @Body() input: UpdateCustomerDto): Promise<CustomerDTO> {
        return this.service.update(id, input)
    }
}
