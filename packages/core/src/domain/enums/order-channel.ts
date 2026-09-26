/**
 * Where an order came from. LLS takes a commission only on `marketplace` orders;
 * orders through the shop's own bot are the shop's business.
 */
export enum OrderChannel {
    SHOP_BOT = "shop_bot",
    MARKETPLACE = "marketplace",
}

export const ORDER_CHANNELS: readonly OrderChannel[] = Object.values(OrderChannel)
