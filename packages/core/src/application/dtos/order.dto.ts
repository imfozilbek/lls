import { toLocationDTO } from "./shop.dto.js"

import type { LocationDTO } from "./shop.dto.js"
import type { CancelledBy, Order } from "../../domain/entities/order.js"
import type { Category } from "../../domain/enums/category.js"
import type { DeliveryFeeRecipient } from "../../domain/enums/delivery-fee.js"
import type { OrderChannel } from "../../domain/enums/order-channel.js"
import type { OrderStatus } from "../../domain/enums/order-status.js"
import type { PaymentMethod, PaymentStatus } from "../../domain/enums/payment.js"
import type { Unit } from "../../domain/enums/unit.js"

export interface OrderItemDTO {
    productId: string
    name: string
    unit: Unit
    category: Category
    /** Per piece, or per kilogram for `kg`. */
    unitPrice: number
    /** Pieces, or grams for `kg`. */
    quantity: number
    total: number
}

export interface OrderDTO {
    id: string
    businessId: string
    customerId: string
    number: number
    channel: OrderChannel
    status: OrderStatus
    nextStatus: OrderStatus | null
    items: OrderItemDTO[]
    subtotal: number
    deliveryFee: number
    depositTotal: number
    bottlesReturned: number
    total: number
    commissionBps: number
    commission: number
    courierId?: string
    courierName?: string
    /** Waiting for a district network courier to take it. */
    waitingForNetwork: boolean
    /** Taken by a district network courier. */
    viaNetwork: boolean
    deliveryFeeTo: DeliveryFeeRecipient
    address: string
    landmark?: string
    location?: LocationDTO
    comment?: string
    customerName: string
    customerPhone?: string
    cancelReason?: string
    cancelledBy?: CancelledBy
    payment: OrderPaymentDTO
    deliveredAt?: string
    createdAt: string
    updatedAt: string
}

export interface OrderPaymentDTO {
    method: PaymentMethod
    status: PaymentStatus
    paidAt?: string
    /** The courier who took the cash at the door. */
    cashCourierId?: string
}

export function toOrderDTO(order: Order): OrderDTO {
    return {
        id: order.id,
        businessId: order.businessId,
        customerId: order.customerId,
        number: order.number,
        channel: order.channel,
        status: order.status,
        nextStatus: order.nextStatus(),
        items: order.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            unit: item.unit,
            category: item.category,
            unitPrice: item.unitPrice.amount,
            quantity: item.quantity,
            total: item.total.amount,
        })),
        subtotal: order.subtotal.amount,
        deliveryFee: order.deliveryFee.amount,
        depositTotal: order.depositTotal.amount,
        bottlesReturned: order.bottlesReturned,
        total: order.total.amount,
        commissionBps: order.commissionBps,
        commission: order.commission.amount,
        courierId: order.courierId,
        courierName: order.courierName,
        waitingForNetwork: order.isWaitingForNetwork(),
        viaNetwork: order.isViaNetwork(),
        deliveryFeeTo: order.deliveryFeeTo,
        address: order.address,
        landmark: order.landmark,
        location: toLocationDTO(order.location),
        comment: order.comment,
        customerName: order.customerName,
        customerPhone: order.customerPhone?.number,
        cancelReason: order.cancelReason,
        cancelledBy: order.cancelledBy,
        payment: {
            method: order.payment.method,
            status: order.payment.status,
            paidAt: order.payment.paidAt?.toISOString(),
            cashCourierId: order.payment.cashCourierId,
        },
        deliveredAt: order.deliveredAt?.toISOString(),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    }
}
