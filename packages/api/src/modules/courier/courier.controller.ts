import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common"

import { TelegramUserDecorator } from "../../common/decorators/telegram-user.decorator.js"
import { TelegramAuthGuard } from "../../common/guards/telegram-auth.guard.js"

import { CourierService } from "./courier.service.js"

import type { TelegramUser } from "../../common/guards/telegram-auth.guard.js"
import type { OrderDTO } from "@lls/core"

@Controller()
export class CourierController {
    constructor(private readonly service: CourierService) {}

    @Get("couriers/available-orders")
    async getAvailableOrders(): Promise<OrderDTO[]> {
        return this.service.getAvailable()
    }

    @Get("couriers/my-orders")
    @UseGuards(TelegramAuthGuard)
    async getMyOrders(@TelegramUserDecorator() user: TelegramUser): Promise<OrderDTO[]> {
        const courier = await this.service.getByTelegramId(user.id)
        return this.service.getOrders(courier.id)
    }

    @Post("orders/:orderId/take")
    @UseGuards(TelegramAuthGuard)
    async takeOrder(
        @Param("orderId") orderId: string,
        @TelegramUserDecorator() user: TelegramUser,
    ): Promise<OrderDTO> {
        const courier = await this.service.getByTelegramId(user.id)
        return this.service.take(orderId, courier.id)
    }

    @Post("couriers/:courierId/take-order/:orderId")
    async takeOrderByCourier(
        @Param("orderId") orderId: string,
        @Param("courierId") courierId: string,
    ): Promise<OrderDTO> {
        return this.service.take(orderId, courierId)
    }

    @Post("orders/:orderId/complete")
    async completeDelivery(@Param("orderId") orderId: string): Promise<OrderDTO> {
        return this.service.complete(orderId)
    }

    @Get("couriers/:courierId/orders")
    async getCourierOrders(@Param("courierId") courierId: string): Promise<OrderDTO[]> {
        return this.service.getOrders(courierId)
    }
}
