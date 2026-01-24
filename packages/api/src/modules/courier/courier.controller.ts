import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"

import { TelegramUserDecorator } from "../../common/decorators/telegram-user.decorator.js"
import { TelegramAuthGuard } from "../../common/guards/telegram-auth.guard.js"

import { CourierService } from "./courier.service.js"

import type { TelegramUser } from "../../common/guards/telegram-auth.guard.js"
import type { OrderDTO } from "@lls/core"

@ApiTags("couriers")
@Controller()
@UseGuards(TelegramAuthGuard)
export class CourierController {
    constructor(private readonly service: CourierService) {}

    @Get("couriers/available-orders")
    async getAvailableOrders(): Promise<OrderDTO[]> {
        return this.service.getAvailable()
    }

    @Get("couriers/my-orders")
    async getMyOrders(@TelegramUserDecorator() user: TelegramUser): Promise<OrderDTO[]> {
        const courier = await this.service.getByTelegramId(user.id)
        return this.service.getOrders(courier.id)
    }

    @Post("orders/:orderId/take")
    async takeOrder(
        @Param("orderId") orderId: string,
        @TelegramUserDecorator() user: TelegramUser,
    ): Promise<OrderDTO> {
        const courier = await this.service.getByTelegramId(user.id)
        return this.service.take(orderId, courier.id)
    }

    @Post("orders/:orderId/complete")
    async completeDelivery(
        @Param("orderId") orderId: string,
        @TelegramUserDecorator() user: TelegramUser,
    ): Promise<OrderDTO> {
        // Verify courier owns this order before completing
        const courier = await this.service.getByTelegramId(user.id)
        return this.service.complete(orderId, courier.id)
    }
}
