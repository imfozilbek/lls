import { OrderStatus, PaymentMethod, PaymentStatus } from "@zumda/core"

import type { OrderDTO } from "@zumda/core"

/**
 * The owner's one main button on an order:
 * - `receipt`: a transfer with no screenshot yet, nothing for the owner: the customer uploads it
 *   and presses «O'tkazdim» first (owner's decision, November 2026; the server refuses otherwise);
 * - `money`: «Pul keldi, qabul qilish» under the screenshot (a transfer order starts only after
 *   the money);
 * - `step`: the next status;
 * - `choose`: who takes it, before «Tayyor» (owner's decision, November 2026; the server refuses
 *   otherwise): «Kuryerga topshirish» in a shop with couriers, «O'zim yetkazaman» without them
 *   (the shop's only courier was chosen by itself when the order was accepted);
 * - `dispatcher`: the dispatcher sends it on and marks it delivered, nothing for the owner;
 * - `courier`: the courier carries it and says «Yetkazdim»; the owner only sees it go (a quiet
 *   «Yetkazildi deb belgilash» stays for a courier who went silent).
 */
export type OwnerStep =
    | { kind: "receipt" }
    | { kind: "money" }
    | { kind: "step"; to: OrderStatus }
    | { kind: "choose" }
    | { kind: "dispatcher"; to: OrderStatus }
    | { kind: "courier"; to: OrderStatus }

/** The main button for this order; null once it is finished. */
export function ownerStep(order: OrderDTO): OwnerStep | null {
    const next = order.nextStatus
    if (!next) {
        return null
    }
    const waitsForMoney =
        next === OrderStatus.ACCEPTED &&
        order.payment.method !== PaymentMethod.CASH &&
        order.payment.status !== PaymentStatus.PAID
    if (waitsForMoney) {
        return order.payment.status === PaymentStatus.UNPAID
            ? { kind: "receipt" }
            : { kind: "money" }
    }
    const leaves = next === OrderStatus.PICKED_UP || next === OrderStatus.DELIVERED
    if (order.dispatcher && leaves) {
        return { kind: "dispatcher", to: next }
    }
    // On the way with a courier: the door is the courier's step, not the owner's.
    if (next === OrderStatus.DELIVERED && order.courierName && !order.ownerDelivers) {
        return { kind: "courier", to: next }
    }
    const goesOn = next === OrderStatus.READY || next === OrderStatus.PICKED_UP
    if (order.needsCourierChoice && goesOn) {
        return { kind: "choose" }
    }
    return { kind: "step", to: next }
}
