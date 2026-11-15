import { OrderStatus, PaymentMethod, PaymentStatus } from "@zumda/core"

import type { OrderDTO } from "@zumda/core"

/**
 * The owner's one main button on an order:
 * - `money`: «Pul keldi, qabul qilish» (a transfer order starts only after the money);
 * - `step`: the next status;
 * - `choose`: «Kuryerga topshirish» (owner's decision, November 2026: a shop with couriers hands
 *   the order to one, or takes it itself, before «Tayyor»; the server refuses otherwise);
 * - `dispatcher`: the dispatcher sends it on and marks it delivered, nothing for the owner.
 */
export type OwnerStep =
    | { kind: "money" }
    | { kind: "step"; to: OrderStatus }
    | { kind: "choose" }
    | { kind: "dispatcher"; to: OrderStatus }

/** The main button for this order; null once it is finished. */
export function ownerStep(order: OrderDTO, shopHasCouriers: boolean): OwnerStep | null {
    const next = order.nextStatus
    if (!next) {
        return null
    }
    const waitsForMoney =
        next === OrderStatus.ACCEPTED &&
        order.payment.method !== PaymentMethod.CASH &&
        order.payment.status !== PaymentStatus.PAID
    if (waitsForMoney) {
        return { kind: "money" }
    }
    const leaves = next === OrderStatus.PICKED_UP || next === OrderStatus.DELIVERED
    if (order.dispatcher && leaves) {
        return { kind: "dispatcher", to: next }
    }
    const goesOn = next === OrderStatus.READY || next === OrderStatus.PICKED_UP
    if (shopHasCouriers && order.needsCourierChoice && goesOn) {
        return { kind: "choose" }
    }
    return { kind: "step", to: next }
}
