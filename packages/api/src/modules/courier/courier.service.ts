import {
    CompleteDeliveryUseCase,
    GetAvailableOrdersUseCase,
    GetCourierByTelegramIdUseCase,
    GetCourierOrdersUseCase,
    TakeOrderUseCase,
} from "@lls/core"
import { Injectable } from "@nestjs/common"

import { MongoDbCourierRepository } from "../../infrastructure/repositories/mongodb-courier.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"

import type { CourierDTO, OrderDTO } from "@lls/core"

@Injectable()
export class CourierService {
    private readonly getAvailableOrders: GetAvailableOrdersUseCase
    private readonly takeOrder: TakeOrderUseCase
    private readonly completeDelivery: CompleteDeliveryUseCase
    private readonly getCourierOrders: GetCourierOrdersUseCase
    private readonly getCourierByTelegramId: GetCourierByTelegramIdUseCase

    constructor(
        private readonly orderRepository: MongoDbOrderRepository,
        private readonly courierRepository: MongoDbCourierRepository,
    ) {
        this.getAvailableOrders = new GetAvailableOrdersUseCase(orderRepository)
        this.takeOrder = new TakeOrderUseCase(orderRepository, courierRepository)
        this.completeDelivery = new CompleteDeliveryUseCase(orderRepository)
        this.getCourierOrders = new GetCourierOrdersUseCase(orderRepository)
        this.getCourierByTelegramId = new GetCourierByTelegramIdUseCase(courierRepository)
    }

    async getAvailable(): Promise<OrderDTO[]> {
        return this.getAvailableOrders.execute()
    }

    async getByTelegramId(telegramId: number): Promise<CourierDTO> {
        return this.getCourierByTelegramId.execute(telegramId)
    }

    async take(orderId: string, courierId: string): Promise<OrderDTO> {
        return this.takeOrder.execute(orderId, courierId)
    }

    async complete(orderId: string): Promise<OrderDTO> {
        return this.completeDelivery.execute(orderId)
    }

    async getOrders(courierId: string): Promise<OrderDTO[]> {
        return this.getCourierOrders.execute(courierId)
    }
}
