import { requireText } from "../shared/guards.js"

/** One note of a dispatcher: a tracking number, the taxi's plate, the driver's phone, the price. */
export const DELIVERY_NOTE_MAX = 300
/** Enough for a parcel that travels for days; a bound for the order's row. */
export const MAX_DELIVERY_NOTES = 20

/**
 * What the dispatcher tells the customer about the delivery (owner's decision, November 2026):
 * the customer sees every note on the order screen and gets each one from the shop's bot.
 */
export interface DeliveryNote {
    readonly at: Date
    readonly text: string
}

export function deliveryNote(text: string, at: Date): DeliveryNote {
    return Object.freeze({ at, text: requireText("note", text, DELIVERY_NOTE_MAX) })
}
