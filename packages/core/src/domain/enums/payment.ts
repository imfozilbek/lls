/** How the customer pays: cash, or a transfer to the shop's card. No payment gateways. */
export enum PaymentMethod {
    CASH = "cash",
    CARD_TRANSFER = "card_transfer",
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = Object.values(PaymentMethod)

/**
 * Where the money of an order stands.
 * - `unpaid`: nothing yet (cash on delivery, or delivered on credit — a debt).
 * - `awaiting`: the customer pays by transfer; the owner has not seen it arrive yet.
 * - `paid`: the money is with the shop (with the courier until they hand it over).
 * - `refund_due`: paid, then cancelled — the shop owes it back.
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

/** What happened at the door: paid in cash, paid by transfer, or will pay later (a debt). */
export enum PaidWith {
    CASH = "cash",
    CARD_TRANSFER = "card_transfer",
    LATER = "later",
}

export const PAID_WITH: readonly PaidWith[] = Object.values(PaidWith)
