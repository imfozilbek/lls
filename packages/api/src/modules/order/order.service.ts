import {
    CancelOrderUseCase,
    CreateOrderUseCase,
    GetBusinessOrdersUseCase,
    GetCustomerByTelegramIdUseCase,
    GetCustomerOrdersUseCase,
    GetOrderUseCase,
    UpdateOrderStatusUseCase,
} from "@lls/core"
import { Injectable } from "@nestjs/common"

import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbCustomerRepository } from "../../infrastructure/repositories/mongodb-customer.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"

import type { CreateOrderInput, OrderDTO, OrderStatus } from "@lls/core"

@Injectable()
export class OrderService {
    private readonly createOrder: CreateOrderUseCase
    private readonly getOrder: GetOrderUseCase
    private readonly getCustomerOrders: GetCustomerOrdersUseCase
    private readonly getBusinessOrders: GetBusinessOrdersUseCase
    private readonly updateOrderStatus: UpdateOrderStatusUseCase
    private readonly cancelOrder: CancelOrderUseCase
    private readonly getCustomerByTelegramId: GetCustomerByTelegramIdUseCase

    constructor(
        private readonly orderRepository: MongoDbOrderRepository,
        private readonly customerRepository: MongoDbCustomerRepository,
        private readonly businessRepository: MongoDbBusinessRepository,
    ) {
        this.createOrder = new CreateOrderUseCase(
            orderRepository,
            customerRepository,
            businessRepository,
        )
        this.getOrder = new GetOrderUseCase(orderRepository)
        this.getCustomerOrders = new GetCustomerOrdersUseCase(orderRepository)
        this.getBusinessOrders = new GetBusinessOrdersUseCase(orderRepository)
        this.updateOrderStatus = new UpdateOrderStatusUseCase(orderRepository)
        this.cancelOrder = new CancelOrderUseCase(orderRepository)
        this.getCustomerByTelegramId = new GetCustomerByTelegramIdUseCase(customerRepository)
    }

    async create(input: CreateOrderInput): Promise<OrderDTO> {
        return this.createOrder.execute(input)
    }

    async getById(id: string): Promise<OrderDTO> {
        return this.getOrder.execute(id)
    }

    async getByCustomer(customerId: string): Promise<OrderDTO[]> {
        return this.getCustomerOrders.execute(customerId)
    }

    async getByCustomerTelegramId(telegramId: number): Promise<OrderDTO[]> {
        const customer = await this.getCustomerByTelegramId.execute(telegramId)
        return this.getCustomerOrders.execute(customer.id)
    }

    async getByBusiness(businessId: string, status?: OrderStatus): Promise<OrderDTO[]> {
        return this.getBusinessOrders.execute({ businessId, status })
    }

    async updateStatus(id: string, status: OrderStatus): Promise<OrderDTO> {
        return this.updateOrderStatus.execute(id, status)
    }

    async cancel(id: string, reason?: string): Promise<OrderDTO> {
        return this.cancelOrder.execute(id, reason)
    }
}
