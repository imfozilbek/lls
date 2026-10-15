import { beforeEach, describe, expect, it } from "vitest"

import {
    AskPhonesUseCase,
    PHONE_ASK_BATCH,
    PHONE_ASK_EVERY_MS,
    PhoneAskStatusUseCase,
} from "../../application/use-cases/platform/phone-asks.use-cases.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { OWNER_TG } from "../fixtures.js"
import { FakePhoneAskSender, InMemoryPhoneAskRecipients } from "../in-memory.js"

import type { Clock } from "../../application/ports/clock.js"
import type { PhoneAskDeps } from "../../application/use-cases/platform/phone-asks.use-cases.js"

const ADMIN_TG = 9999
const START = new Date("2026-10-15T09:00:00Z").getTime()

describe("«Raqam so'rash»: everyone without a phone is asked, once a day", () => {
    let recipients: InMemoryPhoneAskRecipients
    let sender: FakePhoneAskSender
    let now: number
    let deps: PhoneAskDeps
    const clock: Clock = { now: () => new Date(now) }
    const press = (): ReturnType<AskPhonesUseCase["execute"]> =>
        new AskPhonesUseCase(deps).execute({ actorTelegramId: ADMIN_TG })

    beforeEach(() => {
        now = START
        recipients = new InMemoryPhoneAskRecipients()
        sender = new FakePhoneAskSender()
        deps = { recipients, sender, clock, platformAdminIds: [ADMIN_TG] }
        recipients.people.push(
            ...Array.from({ length: PHONE_ASK_BATCH + 2 }, (_, i) => ({
                audience: "courier" as const,
                telegramId: 100 + i,
            })),
            { audience: "owner", telegramId: 1 },
        )
    })

    it("asks the owners first, a batch at a time, then nobody until a day has passed", async () => {
        expect(await press()).toEqual({ sent: PHONE_ASK_BATCH, unreachable: 0, left: 3 })
        expect(sender.asked[0]).toEqual({ audience: "owner", telegramId: 1 })
        expect(await press()).toEqual({ sent: 3, unreachable: 0, left: 0 })
        expect(await press()).toEqual({ sent: 0, unreachable: 0, left: 0 })

        // Still without a phone the next day: asked again.
        now = START + PHONE_ASK_EVERY_MS + 1
        expect(await press()).toMatchObject({ sent: PHONE_ASK_BATCH, left: 3 })
    })

    it("someone the bot cannot reach is counted and waits a day like the others", async () => {
        sender.blocked.add(1)
        expect(await press()).toMatchObject({ sent: PHONE_ASK_BATCH - 1, unreachable: 1 })
        expect(recipients.records.find((r) => r.recipient.telegramId === 1)?.outcome).toBe(
            "unreachable",
        )
        await press()
        expect(sender.asked.filter((r) => r.telegramId === 1)).toHaveLength(0)
    })

    it("Telegram down halfway keeps what went out; the next press goes on", async () => {
        sender.failOn = 101
        await expect(press()).rejects.toThrow("Telegram is down")
        expect(sender.asked.map((r) => r.telegramId)).toEqual([1, 100])
        sender.failOn = null
        expect(await press()).toMatchObject({ sent: PHONE_ASK_BATCH, left: 1 })
        expect(sender.asked.filter((r) => r.telegramId === 100)).toHaveLength(1)
    })

    it("only an admin sees who has no phone and asks", async () => {
        const status = new PhoneAskStatusUseCase(deps)
        expect(await status.execute({ actorTelegramId: ADMIN_TG })).toEqual([
            { audience: "owner", total: 1, left: 1 },
            { audience: "courier", total: PHONE_ASK_BATCH + 2, left: PHONE_ASK_BATCH + 2 },
        ])
        await expect(status.execute({ actorTelegramId: OWNER_TG })).rejects.toThrow(ForbiddenError)
        await expect(
            new AskPhonesUseCase(deps).execute({ actorTelegramId: OWNER_TG }),
        ).rejects.toThrow(ForbiddenError)
        expect(sender.asked).toHaveLength(0)
    })
})
