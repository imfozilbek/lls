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
    /** Since when the district network looks for a courier (shown as minutes waited). */
    networkRequestedAt?: string
    /** Taken by a district network courier. */
    viaNetwork: boolean
    deliveryFeeTo: DeliveryFeeRecipient
    /** In a trip of several orders with one courier, and this order's stop there (1…). */
    tripId?: string
    tripStop?: number
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
    /** A cash order: the courier who took the money at the door. */
    cashCourierId?: string
    /** The shop has this order's cash (taken from the courier, or the owner delivered it). */
    cashReceivedAt?: string
    /** A courier holds this order's cash and has not handed it to the shop yet. */
    withCourier: boolean
    /** The shop's card the customer was shown for this order (the money goes there). */
    card?: { number: string; holder: string }
    /** The transfer screenshot (fetched from its own route); warnings for the owner. */
    receipt?: { at: string; reusedFrom?: number; customerRejections: number }
    /** «Pul kelmadi» on this order so far. */
    rejections: number
    /** From when the customer may remind the owner about the transfer; absent unless awaited. */
    remindableAt?: string
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
        networkRequestedAt: order.isWaitingForNetwork()
            ? order.networkRequestedAt?.toISOString()
            : undefined,
        viaNetwork: order.isViaNetwork(),
        deliveryFeeTo: order.deliveryFeeTo,
        tripId: order.tripId,
        tripStop: order.tripStop,
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
            cashReceivedAt: order.payment.cashReceivedAt?.toISOString(),
            withCourier: order.payment.isWithCourier(),
            card: order.payment.card && {
                number: order.payment.card.number,
                holder: order.payment.card.holder,
            },
            receipt: order.payment.receipt && {
                at: order.payment.receipt.at.toISOString(),
                reusedFrom: order.payment.receipt.reusedFrom,
                customerRejections: order.payment.receipt.customerRejections,
            },
            rejections: order.payment.rejections,
            remindableAt: order.payment.remindableAt()?.toISOString(),
        },
        deliveredAt: order.deliveredAt?.toISOString(),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    }
}
