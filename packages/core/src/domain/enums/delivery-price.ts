/**
 * How the customer pays for delivery (owner's decision, November 2026). The owner chooses it in
 * «Ishga tayyor» or «Yetkazib berish»; until then the customer is told nothing about it, never
 * «bepul». A service delivers nothing. Sent to the app as the value.
 */
export enum DeliveryPrice {
    /** Not chosen yet: no delivery line anywhere. */
    UNSET = "unset",
    FREE = "free",
    /** The shop's fee (and its «… dan bepul»), added to the order. */
    FEE = "fee",
    /** Told after the order, by the distance: the customer pays the carrier (a taxi, the post). */
    LATER = "later",
    /** A service: nothing is delivered. */
    NONE = "none",
}

/** What the owner may choose. */
export type DeliveryPriceChoice = DeliveryPrice.FREE | DeliveryPrice.FEE | DeliveryPrice.LATER

export const DELIVERY_PRICE_CHOICES: readonly DeliveryPriceChoice[] = [
    DeliveryPrice.FREE,
    DeliveryPrice.FEE,
    DeliveryPrice.LATER,
]

export function isDeliveryPriceChoice(value: unknown): value is DeliveryPriceChoice {
    return DELIVERY_PRICE_CHOICES.some((choice) => choice === value)
}
