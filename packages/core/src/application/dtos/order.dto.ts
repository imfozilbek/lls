import type { AddressDTO, MoneyDTO } from "./common.dto.js"
import type { OrderItem } from "../../domain/entities/order-item.js"
import type { Order } from "../../domain/entities/order.js"
import type { OrderStatus } from "../../domain/enums/order-status.js"

export interface OrderItemDTO {
    id: string
    productId: string
    productName: string
    quantity: number
    unitPrice: MoneyDTO
    total: MoneyDTO
}

export interface OrderDTO {
    id: string
    customerId: string
    businessId: string
    courierId?: string
    items: OrderItemDTO[]
    deliveryAddress: AddressDTO
    status: OrderStatus
    total: MoneyDTO
    createdAt: string
    updatedAt: string
}

export interface CreateOrderItemInput {
    productId: string
    productName: string
    quantity: number
    unitPrice: MoneyDTO
}

export interface CreateOrderInput {
    customerId: string
    businessId: string
    items: CreateOrderItemInput[]
    deliveryAddress: AddressDTO
}

export interface UpdateOrderStatusInput {
    status: OrderStatus
}

export interface CancelOrderInput {
    reason?: string
}

export interface TakeOrderInput {
    orderId: string
    courierId: string
}

export interface OrderFilter {
    status?: OrderStatus
    customerId?: string
    businessId?: string
    courierId?: string
}

function toOrderItemDTO(item: OrderItem): OrderItemDTO {
    return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: {
            amount: item.unitPrice.amount,
            currency: item.unitPrice.currency,
        },
        total: {
            amount: item.total.amount,
            currency: item.total.currency,
        },
    }
}

export function toOrderDTO(order: Order): OrderDTO {
    const address = order.deliveryAddress
    return {
        id: order.id,
        customerId: order.customerId,
        businessId: order.businessId,
        courierId: order.courierId,
        items: order.items.map(toOrderItemDTO),
        deliveryAddress: {
            street: address.street,
            city: address.city,
            latitude: address.coordinates?.latitude,
            longitude: address.coordinates?.longitude,
        },
        status: order.status,
        total: {
            amount: order.total.amount,
            currency: order.total.currency,
        },
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    }
}
