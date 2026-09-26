import { toLocationDTO } from "./shop.dto.js"

import type { LocationDTO } from "./shop.dto.js"
import type { CancelledBy, Order } from "../../domain/entities/order.js"
import type { OrderStatus } from "../../domain/enums/order-status.js"
import type { Unit } from "../../domain/enums/unit.js"

export interface OrderItemDTO {
    productId: string
    name: string
    unit: Unit
    unitPrice: number
    quantity: number
    total: number
}

export interface OrderDTO {
    id: string
    businessId: string
    number: number
    status: OrderStatus
    nextStatus: OrderStatus | null
    items: OrderItemDTO[]
    subtotal: number
    deliveryFee: number
    total: number
    address: string
    landmark?: string
    location?: LocationDTO
    comment?: string
    customerName: string
    customerPhone?: string
    cancelReason?: string
    cancelledBy?: CancelledBy
    createdAt: string
    updatedAt: string
}

export function toOrderDTO(order: Order): OrderDTO {
    return {
        id: order.id,
        businessId: order.businessId,
        number: order.number,
        status: order.status,
        nextStatus: order.nextStatus(),
        items: order.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            unit: item.unit,
            unitPrice: item.unitPrice.amount,
            quantity: item.quantity,
            total: item.total.amount,
        })),
        subtotal: order.subtotal.amount,
        deliveryFee: order.deliveryFee.amount,
        total: order.total.amount,
        address: order.address,
        landmark: order.landmark,
        location: toLocationDTO(order.location),
        comment: order.comment,
        customerName: order.customerName,
        customerPhone: order.customerPhone?.number,
        cancelReason: order.cancelReason,
        cancelledBy: order.cancelledBy,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    }
}
