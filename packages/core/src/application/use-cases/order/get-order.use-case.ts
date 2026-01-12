import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderDTO } from "../../dtos/order.dto.js"
import type { OrderRepository } from "../../ports/order-repository.js"

export class GetOrderUseCase {
    constructor(private readonly orderRepository: OrderRepository) {}

    async execute(id: string): Promise<OrderDTO> {
        const order = await this.orderRepository.findById(id)

        if (!order) {
            throw EntityNotFoundError.order(id)
        }

        return toOrderDTO(order)
    }
}
