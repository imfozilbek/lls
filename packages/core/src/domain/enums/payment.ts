/**
 * How the customer paid. Only transfers to the shop's card now (no payment gateways); `cash` is
 * kept to read orders from before.
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
