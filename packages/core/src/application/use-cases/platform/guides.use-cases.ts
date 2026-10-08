import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"

import type { Clock } from "../../ports/clock.js"
import type {
    GuideAudience,
    GuideCount,
    GuideRecipients,
    GuideSender,
} from "../../ports/guide-recipients.js"

/**
 * People one press sends to: Telegram fetches the video for each message, so ten keep a press
 * to seconds, well under a Worker request's 50 calls. The app presses again until nobody is left.
 */
export const GUIDE_BATCH = 10

export interface GuideDeps {
    recipients: GuideRecipients
    sender: GuideSender
    clock: Clock
    platformAdminIds: readonly number[]
}

/** What one press did, and how many of the audience still wait for it. */
export interface GuideBatchDTO {
    audience: GuideAudience
    sent: number
    unreachable: number
    left: number
}

function requireAdmin(deps: GuideDeps, actorTelegramId: number): void {
    if (!deps.platformAdminIds.includes(actorTelegramId)) {
        throw ForbiddenError.notPlatformAdmin()
    }
}

/** «Qo'llanma» in «Platforma»: each audience, how many it reaches and how many are left. */
export class GuideStatusUseCase {
    constructor(private readonly deps: GuideDeps) {}

    async execute(input: { actorTelegramId: number }): Promise<GuideCount[]> {
        requireAdmin(this.deps, input.actorTelegramId)
        return this.deps.recipients.counts()
    }
}

/**
 * One batch of the audience's guide. Each person is recorded right after their message, so a
 * failure halfway (Telegram down) keeps what went out and the next press goes on from there.
 */
export class SendGuidesUseCase {
    constructor(private readonly deps: GuideDeps) {}

    async execute(input: {
        actorTelegramId: number
        audience: GuideAudience
    }): Promise<GuideBatchDTO> {
        requireAdmin(this.deps, input.actorTelegramId)
        const { recipients, sender, clock } = this.deps
        const batch = await recipients.next(input.audience, GUIDE_BATCH)
        let sent = 0
        let unreachable = 0
        for (const recipient of batch) {
            const outcome = await sender.send(input.audience, recipient)
            await recipients.record(input.audience, recipient, outcome, clock.now())
            if (outcome === "sent") {
                sent += 1
            } else {
                unreachable += 1
            }
        }
        const counts = await recipients.counts()
        const left = counts.find((count) => count.audience === input.audience)?.left ?? 0
        return { audience: input.audience, sent, unreachable, left }
    }
}
