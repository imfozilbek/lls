import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderDTO } from "../../dtos/order.dto.js"
import type { OrderRepository } from "../../ports/order-repository.js"


export class CompleteDeliveryUseCase {
    constructor(private readonly orderRepository: OrderRepository) {}

    async execute(orderId: string): Promise<OrderDTO> {
        const order = await this.orderRepository.findById(orderId)

        if (!order) {
            throw EntityNotFoundError.order(orderId)
        }

        order.deliver()
        await this.orderRepository.save(order)

        return toOrderDTO(order)
    }
}
