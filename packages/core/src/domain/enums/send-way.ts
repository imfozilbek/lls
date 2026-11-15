/**
 * How a dispatcher sent an order on (owner's decision, November 2026): the courier of a shop may
 * be a dispatcher who hands the parcel to a taxi, the post or someone else, or carries it
 * themself. The carrier is never in Zumda: only this word and the dispatcher's notes are.
 * Stored as the value; only added to, never renamed.
 */
export enum SendWay {
    /** The dispatcher carries it themself. */
    SELF = "self",
    TAXI = "taxi",
    POST = "post",
    /** Anyone else: the note says who (required with this way). */
    OTHER = "other",
}

export const SEND_WAYS: readonly SendWay[] = Object.values(SendWay)

export function isSendWay(value: unknown): value is SendWay {
    return SEND_WAYS.some((way) => way === value)
}
