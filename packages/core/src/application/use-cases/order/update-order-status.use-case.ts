import { canTransitionTo, OrderStatus } from "../../../domain/enums/order-status.js"
import { InvalidOrderTransitionError } from "../../../domain/errors/invalid-transition.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderDTO } from "../../dtos/order.dto.js"
import type { OrderRepository } from "../../ports/order-repository.js"

export class UpdateOrderStatusUseCase {
    constructor(private readonly orderRepository: OrderRepository) {}

    async execute(id: string, newStatus: OrderStatus): Promise<OrderDTO> {
        const order = await this.orderRepository.findById(id)

        if (!order) {
            throw EntityNotFoundError.order(id)
        }

        if (!canTransitionTo(order.status, newStatus)) {
            throw new InvalidOrderTransitionError(id, order.status, newStatus)
        }

        order.transitionTo(newStatus)
        await this.orderRepository.save(order)

        return toOrderDTO(order)
    }
}
