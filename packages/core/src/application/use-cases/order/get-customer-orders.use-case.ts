import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderDTO } from "../../dtos/order.dto.js"
import type { OrderRepository } from "../../ports/order-repository.js"

export class GetCustomerOrdersUseCase {
    constructor(private readonly orderRepository: OrderRepository) {}

    async execute(customerId: string): Promise<OrderDTO[]> {
        const orders = await this.orderRepository.findByCustomerId(customerId)
        return orders.map(toOrderDTO)
    }
}
