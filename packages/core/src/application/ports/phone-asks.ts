import type { GuideOutcome } from "./guide-recipients.js"

/**
 * «Raqam so'rash» (owner's decision, October 2026): a platform admin asks everyone a missing
 * phone stops, with one button in their role's bot. Owners whose shop has no number to call (it
 * takes no orders) from Zumda | Business, couriers without a phone (no approval, no orders) from
 * Zumda | Kuryer. Each person at most once a day.
 */
export const PHONE_ASK_AUDIENCES = ["owner", "courier"] as const

export type PhoneAskAudience = (typeof PHONE_ASK_AUDIENCES)[number]

/** Someone to ask: an owner (all their shops without a number) or a courier. */
export interface PhoneAskRecipient {
    audience: PhoneAskAudience
    telegramId: number
}

/** One audience: everyone without a phone now, and who was not asked since `since`. */
export interface PhoneAskCount {
    audience: PhoneAskAudience
    total: number
    left: number
}

export interface PhoneAskRecipients {
    /** People without a phone not asked since `since`: owners first, in a steady order. */
    next(since: Date, limit: number): Promise<PhoneAskRecipient[]>
    counts(since: Date): Promise<PhoneAskCount[]>
    /** The last ask, sent or unreachable: the person waits a day before the next one. */
    record(recipient: PhoneAskRecipient, outcome: GuideOutcome, at: Date): Promise<void>
}

/** Asks one person; a passing Telegram failure throws (nothing is recorded). */
export interface PhoneAskSender {
    ask(recipient: PhoneAskRecipient): Promise<GuideOutcome>
}
