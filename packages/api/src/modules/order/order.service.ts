import {
    CancelOrderUseCase,
    CreateOrderUseCase,
    GetBusinessOrdersUseCase,
    GetBusinessUseCase,
    GetCustomerByTelegramIdUseCase,
    GetCustomerOrdersUseCase,
    GetOrderUseCase,
    OrderStatus as OrderStatusEnum,
    UpdateOrderStatusUseCase,
} from "@lls/core"
import { Injectable } from "@nestjs/common"

import { paginate, PaginatedResult, PaginationDto } from "../../common/dto/pagination.dto.js"
import { EventsGateway } from "../../gateway/events.gateway.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbCustomerRepository } from "../../infrastructure/repositories/mongodb-customer.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"
import { TelegramNotificationService } from "../../notifications/telegram-notification.service.js"

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
    private readonly getBusiness: GetBusinessUseCase

    constructor(
        private readonly orderRepository: MongoDbOrderRepository,
        private readonly customerRepository: MongoDbCustomerRepository,
        private readonly businessRepository: MongoDbBusinessRepository,
        private readonly eventsGateway: EventsGateway,
        private readonly notificationService: TelegramNotificationService,
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
        this.getBusiness = new GetBusinessUseCase(businessRepository)
    }

    async create(input: CreateOrderInput): Promise<OrderDTO> {
        const order = await this.createOrder.execute(input)

        // Get business and customer for notifications
        let businessName = "Unknown"
        let businessTelegramId: number | { value: number } | null = null
        let customerTelegramId: number | { value: number } | null = null

        try {
            const business = await this.getBusiness.execute(order.businessId)
            businessName = business.name
            businessTelegramId = business.telegramId
        } catch {
            // Use defaults if not found
        }

        try {
            const customer = await this.customerRepository.findById(order.customerId)
            customerTelegramId = customer?.telegramId ?? null
        } catch {
            // Skip customer notification if not found
        }

        // Emit WebSocket event for new order
        this.eventsGateway.emitOrderCreated(order.businessId, {
            orderId: order.id,
            businessId: order.businessId,
            customerId: order.customerId,
            total: order.total,
            status: order.status,
            createdAt: order.createdAt,
        })

        // Notify couriers about new available order
        this.eventsGateway.emitNewOrderAvailable({
            orderId: order.id,
            businessId: order.businessId,
            businessName,
            deliveryAddress: order.deliveryAddress,
            total: order.total,
            createdAt: order.createdAt,
        })

        // Send Telegram notifications
        if (customerTelegramId) {
            void this.notificationService.sendOrderConfirmation(
                customerTelegramId,
                order,
                businessName,
            )
        }
        if (businessTelegramId) {
            void this.notificationService.sendNewOrderNotification(businessTelegramId, order)
        }

        return order
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

    async getByBusiness(
        businessId: string,
        status?: OrderStatus,
        pagination?: PaginationDto,
    ): Promise<PaginatedResult<OrderDTO>> {
        const page = pagination?.page ?? 1
        const limit = pagination?.limit ?? 20

        const all = await this.getBusinessOrders.execute({ businessId, status })
        const total = all.length
        const start = (page - 1) * limit
        const items = all.slice(start, start + limit)

        return paginate(items, total, page, limit)
    }

    async updateStatus(id: string, status: OrderStatus): Promise<OrderDTO> {
        // Get current order to know previous status
        const currentOrder = await this.getOrder.execute(id)
        const previousStatus = currentOrder.status

        const order = await this.updateOrderStatus.execute(id, status)

        // Emit WebSocket event for status change
        this.eventsGateway.emitOrderStatusChanged(order.id, order.businessId, {
            orderId: order.id,
            previousStatus,
            newStatus: order.status,
            updatedAt: order.updatedAt,
        })

        // Send Telegram notification for status change
        try {
            const customer = await this.customerRepository.findById(order.customerId)
            if (customer?.telegramId) {
                void this.notificationService.sendStatusChangeNotification(
                    customer.telegramId,
                    order.id,
                    previousStatus as OrderStatusEnum,
                    order.status as OrderStatusEnum,
                )

                // Send delivery complete notification
                if (order.status === OrderStatusEnum.DELIVERED) {
                    void this.notificationService.sendDeliveryCompleteNotification(
                        customer.telegramId,
                        order.id,
                    )
                }
            }
        } catch {
            // Skip notification if customer not found
        }

        return order
    }

    async cancel(id: string, reason?: string): Promise<OrderDTO> {
        // Get current order to know previous status
        const currentOrder = await this.getOrder.execute(id)
        const previousStatus = currentOrder.status

        const order = await this.cancelOrder.execute(id, reason)

        // Emit WebSocket event for order cancellation
        this.eventsGateway.emitOrderCancelled(order.id, order.businessId, {
            orderId: order.id,
            previousStatus,
            newStatus: order.status,
            updatedAt: order.updatedAt,
        })

        return order
    }
}
