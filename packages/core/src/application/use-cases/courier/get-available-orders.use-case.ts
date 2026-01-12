import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderDTO } from "../../dtos/order.dto.js"
import type { OrderRepository } from "../../ports/order-repository.js"


export class GetAvailableOrdersUseCase {
    constructor(private readonly orderRepository: OrderRepository) {}

    async execute(): Promise<OrderDTO[]> {
        const orders = await this.orderRepository.findAvailableForCourier()
        return orders.map(toOrderDTO)
    }
}
