import { Order } from "../../domain/entities/order.js"
import { OrderStatus } from "../../domain/enums/order-status.js"

export interface OrderRepository {
    findById(id: string): Promise<Order | null>
    findByCustomerId(customerId: string): Promise<Order[]>
    findByBusinessId(businessId: string): Promise<Order[]>
    findByCourierId(courierId: string): Promise<Order[]>
    findByStatus(status: OrderStatus): Promise<Order[]>
    findPendingByBusinessId(businessId: string): Promise<Order[]>
    findAvailableForCourier(): Promise<Order[]>
    save(order: Order): Promise<void>
    delete(id: string): Promise<void>
}
