import {
    CompleteDeliveryUseCase,
    GetAvailableOrdersUseCase,
    GetCourierByTelegramIdUseCase,
    GetCourierOrdersUseCase,
    GetOrderUseCase,
    TakeOrderUseCase,
} from "@lls/core"
import { Injectable } from "@nestjs/common"

import { EventsGateway } from "../../gateway/events.gateway.js"
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
    private readonly getOrder: GetOrderUseCase

    constructor(
        private readonly orderRepository: MongoDbOrderRepository,
        private readonly courierRepository: MongoDbCourierRepository,
        private readonly eventsGateway: EventsGateway,
    ) {
        this.getAvailableOrders = new GetAvailableOrdersUseCase(orderRepository)
        this.takeOrder = new TakeOrderUseCase(orderRepository, courierRepository)
        this.completeDelivery = new CompleteDeliveryUseCase(orderRepository)
        this.getCourierOrders = new GetCourierOrdersUseCase(orderRepository)
        this.getCourierByTelegramId = new GetCourierByTelegramIdUseCase(courierRepository)
        this.getOrder = new GetOrderUseCase(orderRepository)
    }

    async getAvailable(): Promise<OrderDTO[]> {
        return this.getAvailableOrders.execute()
    }

    async getByTelegramId(telegramId: number): Promise<CourierDTO> {
        return this.getCourierByTelegramId.execute(telegramId)
    }

    async take(orderId: string, courierId: string): Promise<OrderDTO> {
        // Get courier info for the event
        const courier = await this.courierRepository.findById(courierId)
        const previousOrder = await this.getOrder.execute(orderId)
        const previousStatus = previousOrder.status

        const order = await this.takeOrder.execute(orderId, courierId)

        // Emit courier assigned event
        if (courier) {
            this.eventsGateway.emitCourierAssigned(order.id, {
                orderId: order.id,
                courierId: courier.id,
                courierName: courier.name,
                assignedAt: order.updatedAt,
            })
        }

        // Emit order status changed event
        this.eventsGateway.emitOrderStatusChanged(order.id, order.businessId, {
            orderId: order.id,
            previousStatus,
            newStatus: order.status,
            updatedAt: order.updatedAt,
        })

        return order
    }

    async complete(orderId: string): Promise<OrderDTO> {
        const previousOrder = await this.getOrder.execute(orderId)
        const previousStatus = previousOrder.status

        const order = await this.completeDelivery.execute(orderId)

        // Emit order status changed event
        this.eventsGateway.emitOrderStatusChanged(order.id, order.businessId, {
            orderId: order.id,
            previousStatus,
            newStatus: order.status,
            updatedAt: order.updatedAt,
        })

        return order
    }

    async getOrders(courierId: string): Promise<OrderDTO[]> {
        return this.getCourierOrders.execute(courierId)
    }
}
