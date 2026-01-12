import { toOrderDTO } from "../../dtos/order.dto.js"

import type { OrderStatus } from "../../../domain/enums/order-status.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { OrderRepository } from "../../ports/order-repository.js"

export interface GetBusinessOrdersInput {
    businessId: string
    status?: OrderStatus
}

export class GetBusinessOrdersUseCase {
    constructor(private readonly orderRepository: OrderRepository) {}

    async execute(input: GetBusinessOrdersInput): Promise<OrderDTO[]> {
        let orders

        if (input.status) {
            const allByBusiness = await this.orderRepository.findByBusinessId(input.businessId)
            orders = allByBusiness.filter((o) => o.status === input.status)
        } else {
            orders = await this.orderRepository.findByBusinessId(input.businessId)
        }

        return orders.map(toOrderDTO)
    }
}
