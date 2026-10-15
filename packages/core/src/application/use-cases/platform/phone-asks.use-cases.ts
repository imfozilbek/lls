import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"

import type { Clock } from "../../ports/clock.js"
import type { PhoneAskCount, PhoneAskRecipients, PhoneAskSender } from "../../ports/phone-asks.js"

/** People one press asks; the app presses again until nobody is left for today. */
export const PHONE_ASK_BATCH = 10

/** Someone asked is asked again only a day later (owner's decision, October 2026). */
export const PHONE_ASK_EVERY_MS = 24 * 60 * 60 * 1000

export interface PhoneAskDeps {
    recipients: PhoneAskRecipients
    sender: PhoneAskSender
    clock: Clock
    platformAdminIds: readonly number[]
}

/** What one press did, and how many are still to ask today. */
export interface PhoneAskBatchDTO {
    sent: number
    unreachable: number
    left: number
}

function requireAdmin(deps: PhoneAskDeps, actorTelegramId: number): void {
    if (!deps.platformAdminIds.includes(actorTelegramId)) {
        throw ForbiddenError.notPlatformAdmin()
    }
}

/** The last day: whoever was asked within it waits. */
function since(clock: Clock): Date {
    return new Date(clock.now().getTime() - PHONE_ASK_EVERY_MS)
}

/** «Raqam so'rash» in «Platforma»: who has no phone, and who is still to ask today. */
export class PhoneAskStatusUseCase {
    constructor(private readonly deps: PhoneAskDeps) {}

    async execute(input: { actorTelegramId: number }): Promise<PhoneAskCount[]> {
        requireAdmin(this.deps, input.actorTelegramId)
        return this.deps.recipients.counts(since(this.deps.clock))
    }
}

/**
 * One batch of asks, owners first. Each person is recorded right after their message, so a
 * failure halfway (Telegram down) keeps what went out and the next press goes on from there.
 */
export class AskPhonesUseCase {
    constructor(private readonly deps: PhoneAskDeps) {}

    async execute(input: { actorTelegramId: number }): Promise<PhoneAskBatchDTO> {
        requireAdmin(this.deps, input.actorTelegramId)
        const { recipients, sender, clock } = this.deps
        const batch = await recipients.next(since(clock), PHONE_ASK_BATCH)
        let sent = 0
        let unreachable = 0
        for (const recipient of batch) {
            const outcome = await sender.ask(recipient)
            await recipients.record(recipient, outcome, clock.now())
            if (outcome === "sent") {
                sent += 1
            } else {
                unreachable += 1
            }
        }
        const counts = await recipients.counts(since(clock))
        const left = counts.reduce((sum, count) => sum + count.left, 0)
        return { sent, unreachable, left }
    }
}
