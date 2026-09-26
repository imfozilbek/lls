import type { Order } from "../../domain/entities/order.js"
import type { OrderStatus } from "../../domain/enums/order-status.js"
import type { Page, PageRequest } from "../dtos/pagination.js"
import type { OrderStatsDTO } from "../dtos/stats.dto.js"

export interface OrderRepository {
    findById(id: string): Promise<Order | null>
    /** The next free order number in this shop (1, 2, 3 …). */
    nextNumber(businessId: string): Promise<number>
    /** Returns false if another order took the same number first. */
    insert(order: Order): Promise<boolean>
    save(order: Order): Promise<void>
    /** Newest first. */
    listByBusiness(
        businessId: string,
        statuses: readonly OrderStatus[] | undefined,
        page: PageRequest,
    ): Promise<Page<Order>>
    /** Newest first. */
    listByCustomer(customerId: string, businessId: string, page: PageRequest): Promise<Page<Order>>
    /** Orders created in [from, to). */
    stats(businessId: string, from: Date, to: Date): Promise<OrderStatsDTO>
}
