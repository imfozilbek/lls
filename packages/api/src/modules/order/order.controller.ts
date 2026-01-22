import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"

import { BusinessAuthMode } from "../../common/decorators/index.js"
import { TelegramUserDecorator } from "../../common/decorators/telegram-user.decorator.js"
import { BusinessAuthGuard, TelegramAuthGuard } from "../../common/guards/index.js"

import { CreateOrderDto, UpdateOrderStatusDto } from "./dto/index.js"
import { OrderService } from "./order.service.js"

import type { TelegramUser } from "../../common/guards/telegram-auth.guard.js"
import type { OrderDTO, OrderStatus } from "@lls/core"

@Controller()
export class OrderController {
    constructor(private readonly service: OrderService) {}

    @Post("orders")
    @UseGuards(TelegramAuthGuard)
    async create(@Body() input: CreateOrderDto): Promise<OrderDTO> {
        return this.service.create(input)
    }

    @Get("orders/my")
    @UseGuards(TelegramAuthGuard)
    async getMyOrders(@TelegramUserDecorator() user: TelegramUser): Promise<OrderDTO[]> {
        return this.service.getByCustomerTelegramId(user.id)
    }

    @Get("orders/:id")
    async getById(@Param("id") id: string): Promise<OrderDTO> {
        return this.service.getById(id)
    }

    @Get("customers/:customerId/orders")
    async getByCustomer(@Param("customerId") customerId: string): Promise<OrderDTO[]> {
        return this.service.getByCustomer(customerId)
    }

    @Get("businesses/:businessId/orders")
    @UseGuards(TelegramAuthGuard, BusinessAuthGuard)
    async getByBusiness(
        @Param("businessId") businessId: string,
        @Query("status") status?: OrderStatus,
    ): Promise<OrderDTO[]> {
        return this.service.getByBusiness(businessId, status)
    }

    @Patch("orders/:id/status")
    @UseGuards(TelegramAuthGuard, BusinessAuthGuard)
    @BusinessAuthMode("order")
    async updateStatus(
        @Param("id") id: string,
        @Body() input: UpdateOrderStatusDto,
    ): Promise<OrderDTO> {
        return this.service.updateStatus(id, input.status)
    }

    @Post("orders/:id/cancel")
    @UseGuards(TelegramAuthGuard)
    async cancel(@Param("id") id: string, @Body("reason") reason?: string): Promise<OrderDTO> {
        return this.service.cancel(id, reason)
    }
}
