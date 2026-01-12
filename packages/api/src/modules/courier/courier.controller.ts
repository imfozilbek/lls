import { Controller, Get, Param, Post } from "@nestjs/common"

import { CourierService } from "./courier.service.js"

import type { OrderDTO } from "@lls/core"

@Controller()
export class CourierController {
    constructor(private readonly service: CourierService) {}

    @Get("couriers/available-orders")
    async getAvailableOrders(): Promise<OrderDTO[]> {
        return this.service.getAvailable()
    }

    @Post("orders/:orderId/take")
    async takeOrder(
        @Param("orderId") _orderId: string,
    ): Promise<OrderDTO> {
        // TODO: Get courierId from authenticated Telegram user
        throw new Error("courierId must be provided - implement Telegram auth")
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
