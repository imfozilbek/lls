import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderDTO } from "../../dtos/order.dto.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"


export class TakeOrderUseCase {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly courierRepository: CourierRepository,
    ) {}

    async execute(orderId: string, courierId: string): Promise<OrderDTO> {
        const order = await this.orderRepository.findById(orderId)
        if (!order) {
            throw EntityNotFoundError.order(orderId)
        }

        const courier = await this.courierRepository.findById(courierId)
        if (!courier) {
            throw EntityNotFoundError.courier(courierId)
        }

        if (!courier.canTakeOrder()) {
            throw BusinessRuleViolationError.courierNotAvailable(courierId)
        }

        if (order.courierId) {
            throw BusinessRuleViolationError.orderAlreadyHasCourier(orderId)
        }

        order.assignCourier(courierId)
        await this.orderRepository.save(order)

        return toOrderDTO(order)
    }
}
