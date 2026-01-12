import { OrderItem } from "../../../domain/entities/order-item.js"
import { Order } from "../../../domain/entities/order.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { Address } from "../../../domain/value-objects/address.js"
import { Money } from "../../../domain/value-objects/money.js"
import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderDTO, CreateOrderInput } from "../../dtos/order.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"

export class CreateOrderUseCase {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly customerRepository: CustomerRepository,
        private readonly businessRepository: BusinessRepository,
    ) {}

    async execute(input: CreateOrderInput): Promise<OrderDTO> {
        const customer = await this.customerRepository.findById(input.customerId)
        if (!customer) {
            throw EntityNotFoundError.customer(input.customerId)
        }

        const business = await this.businessRepository.findById(input.businessId)
        if (!business) {
            throw EntityNotFoundError.business(input.businessId)
        }

        if (!business.isActive) {
            throw BusinessRuleViolationError.businessNotActive(input.businessId)
        }

        const deliveryAddress = Address.create(
            input.deliveryAddress.street,
            input.deliveryAddress.city,
            input.deliveryAddress.latitude !== undefined &&
                input.deliveryAddress.longitude !== undefined
                ? {
                      latitude: input.deliveryAddress.latitude,
                      longitude: input.deliveryAddress.longitude,
                  }
                : undefined,
        )

        const items = input.items.map((item) =>
            OrderItem.create({
                id: crypto.randomUUID(),
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: Money.create(item.unitPrice.amount, item.unitPrice.currency),
            }),
        )

        const order = Order.create({
            id: crypto.randomUUID(),
            customerId: input.customerId,
            businessId: input.businessId,
            items,
            deliveryAddress,
        })

        await this.orderRepository.save(order)

        return toOrderDTO(order)
    }
}
