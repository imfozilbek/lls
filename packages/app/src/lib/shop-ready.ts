import { PaymentOptions } from "@zumda/core"

import type { ShopPublicDTO } from "@zumda/core"

/**
 * The owner chose a way of paying that works: cash, or the card with a card added (the same rule
 * as `Business.takesPayment`). Not `paymentMethods`: a storefront without a number to call shows
 * none of them, though the owner's payment is set up.
 */
export function paymentReady(
    shop: Pick<ShopPublicDTO, "paymentOptions" | "hasPayoutCard">,
): boolean {
    return shop.paymentOptions !== PaymentOptions.CARD || shop.hasPayoutCard
}

/** Customers and couriers have a number to call: the shop's own, or the owner's own phone. */
export function phoneReady(shop: Pick<ShopPublicDTO, "contactPhone" | "callPhone">): boolean {
    return (shop.contactPhone ?? shop.callPhone) !== undefined
}

/**
 * A customer can order right now: open, and with a way to pay the storefront offers (none while
 * the shop has no card it needs, or no number to call).
 */
export function takesOrdersNow(shop: Pick<ShopPublicDTO, "isOpen" | "paymentMethods">): boolean {
    return shop.isOpen && shop.paymentMethods.length > 0
}
