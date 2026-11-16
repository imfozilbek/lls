import { DeliveryPrice } from "@zumda/core"

import type { OrderDTO, ShopPublicDTO } from "@zumda/core"

/**
 * What a screen says about delivery (owner's decision, November 2026): the fee, «bepul» only when
 * the shop promised it, «keyin aytiladi» when the customer pays the carrier, or nothing at all
 * (a price the owner never chose, a service). One answer for every screen; each says it in its
 * own words.
 */
export type DeliveryShown = number | "free" | "later" | null

/** The storefront and the showcase: what the shop asks for delivery. */
export function shopDelivery(delivery: ShopPublicDTO["delivery"]): DeliveryShown {
    switch (delivery.price) {
        case DeliveryPrice.FEE:
            return delivery.fee
        case DeliveryPrice.FREE:
            return "free"
        case DeliveryPrice.LATER:
            return "later"
        default:
            return null
    }
}

/** The cart: the fee this cart pays; past the shop's «… dan bepul» it is «bepul». */
export function cartDelivery(delivery: ShopPublicDTO["delivery"], fee: number): DeliveryShown {
    const shown = shopDelivery(delivery)
    if (typeof shown === "number") {
        return fee > 0 ? fee : "free"
    }
    return shown
}

/** An order: what was promised when it was placed (old orders say nothing about a fee of 0). */
export function orderDelivery(
    order: Pick<OrderDTO, "deliveryFee" | "deliveryFree" | "customerPaysCarrier">,
): DeliveryShown {
    if (order.customerPaysCarrier) {
        return "later"
    }
    if (order.deliveryFee > 0) {
        return order.deliveryFee
    }
    return order.deliveryFree === true ? "free" : null
}

/** The short fact on the storefront and a showcase card, in the screen's own words. */
export function deliveryFact(
    shown: DeliveryShown,
    words: { free: string; later: string; fee(sum: number): string },
): string | null {
    if (shown === "free") {
        return words.free
    }
    if (shown === "later") {
        return words.later
    }
    return shown === null ? null : words.fee(shown)
}
