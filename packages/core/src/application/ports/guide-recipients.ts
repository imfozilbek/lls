/**
 * «Qo'llanma» (owner's decision, October 2026): everyone already in Zumda gets their role's
 * guide video once, from their role's bot: owners from Zumda | Business, couriers from
 * Zumda | Kuryer, customers from their shop's own bot with an invitation to Zumda | Shop.
 */
export const GUIDE_AUDIENCES = ["owner", "courier", "customer"] as const

export type GuideAudience = (typeof GUIDE_AUDIENCES)[number]

/** One person to send the guide to. */
export interface GuideRecipient {
    telegramId: number
    /** A customer's shop: the one they came to last, whose bot sends the guide. */
    businessId?: string
}

/** Sent, or Telegram will not let the bot write to them (blocked, never opened it). */
export type GuideOutcome = "sent" | "unreachable"

/** One audience in «Qo'llanma»: everyone it reaches now, and who has not had the guide yet. */
export interface GuideCount {
    audience: GuideAudience
    total: number
    left: number
}

export interface GuideRecipients {
    /** People of the audience who have not had the guide, in a steady order. */
    next(audience: GuideAudience, limit: number): Promise<GuideRecipient[]>
    counts(): Promise<GuideCount[]>
    /** Once recorded, sent or unreachable, the person is never written to again by this. */
    record(
        audience: GuideAudience,
        recipient: GuideRecipient,
        outcome: GuideOutcome,
        at: Date,
    ): Promise<void>
}

/** Sends one person the guide; a passing Telegram failure throws (nothing is recorded). */
export interface GuideSender {
    send(audience: GuideAudience, recipient: GuideRecipient): Promise<GuideOutcome>
}
