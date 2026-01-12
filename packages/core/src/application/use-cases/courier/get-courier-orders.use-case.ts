import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderDTO } from "../../dtos/order.dto.js"
import type { OrderRepository } from "../../ports/order-repository.js"


export class GetCourierOrdersUseCase {
    constructor(private readonly orderRepository: OrderRepository) {}

    async execute(courierId: string): Promise<OrderDTO[]> {
        const orders = await this.orderRepository.findByCourierId(courierId)
        return orders.map(toOrderDTO)
    }
}
