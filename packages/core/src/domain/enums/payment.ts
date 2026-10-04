/**
 * How the customer pays: a transfer to the shop's card before the shop starts, or cash to the
 * courier on delivery. No payment gateways.
 */
export enum PaymentMethod {
    CASH = "cash",
    CARD_TRANSFER = "card_transfer",
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = Object.values(PaymentMethod)

/**
 * Where the money of an order stands.
 * - `unpaid`: the customer has not transferred yet; the shop does not start.
 * - `awaiting`: the customer pressed «Я перевёл»; the owner has not seen it arrive yet.
 * - `paid`: the owner saw it on the card; the shop starts.
 * - `refund_due`: paid, then cancelled; the shop owes it back.
 * - `refunded`: given back.
 */
export enum PaymentStatus {
    UNPAID = "unpaid",
    AWAITING = "awaiting",
    PAID = "paid",
    REFUND_DUE = "refund_due",
    REFUNDED = "refunded",
}

export const PAYMENT_STATUSES: readonly PaymentStatus[] = Object.values(PaymentStatus)

/**
 * Which ways of paying a shop takes (the owner chooses in «Sozlamalar»). With `both` the customer
 * picks one at checkout and only that one's rules apply to the order.
 */
export enum PaymentOptions {
    CARD = "card",
    CASH = "cash",
    BOTH = "both",
}

export const PAYMENT_OPTIONS: readonly PaymentOptions[] = Object.values(PaymentOptions)
