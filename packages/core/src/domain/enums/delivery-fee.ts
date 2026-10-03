/** Who gets an order's delivery fee. Fixed in the order when a courier takes it. */
export enum DeliveryFeeRecipient {
    BUSINESS = "business",
}

/**
 * The delivery fee of an order a district network courier delivers.
 * Temporary rule until the owner decides (goal 02): it stays with the shop, as today, and Zumda
 * takes no share. Changing it here changes new orders only: old ones keep their snapshot.
 */
export const NETWORK_DELIVERY_FEE_RECIPIENT = DeliveryFeeRecipient.BUSINESS

export const DELIVERY_FEE_RECIPIENTS: readonly DeliveryFeeRecipient[] =
    Object.values(DeliveryFeeRecipient)
