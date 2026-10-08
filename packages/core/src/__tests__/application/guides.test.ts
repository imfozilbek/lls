import { beforeEach, describe, expect, it } from "vitest"

import {
    GUIDE_BATCH,
    GuideStatusUseCase,
    SendGuidesUseCase,
} from "../../application/use-cases/platform/guides.use-cases.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { OWNER_TG } from "../fixtures.js"
import { FakeGuideSender, InMemoryGuideRecipients, fixedClock } from "../in-memory.js"

import type { GuideDeps } from "../../application/use-cases/platform/guides.use-cases.js"

const ADMIN_TG = 9999
const NOW = new Date("2026-10-08T09:00:00Z")

describe("«Qo'llanma»: everyone gets their role's guide once", () => {
    let recipients: InMemoryGuideRecipients
    let sender: FakeGuideSender
    let deps: GuideDeps
    const press = (audience: "owner" | "courier" | "customer" = "courier") =>
        new SendGuidesUseCase(deps).execute({ actorTelegramId: ADMIN_TG, audience })

    beforeEach(() => {
        recipients = new InMemoryGuideRecipients()
        sender = new FakeGuideSender()
        deps = { recipients, sender, clock: fixedClock(NOW), platformAdminIds: [ADMIN_TG] }
        recipients.people.owner = [{ telegramId: 1 }, { telegramId: 2 }]
        recipients.people.courier = Array.from({ length: GUIDE_BATCH + 5 }, (_, i) => ({
            telegramId: 100 + i,
        }))
        recipients.people.customer = [{ telegramId: 500, businessId: "biz-1" }]
    })

    it("sends a batch, then the rest; a second round sends nobody", async () => {
        expect(await press()).toEqual({
            audience: "courier",
            sent: GUIDE_BATCH,
            unreachable: 0,
            left: 5,
        })
        expect(await press()).toMatchObject({ sent: 5, left: 0 })
        expect(await press()).toMatchObject({ sent: 0, unreachable: 0, left: 0 })
        expect(sender.sent).toHaveLength(GUIDE_BATCH + 5)
        expect(recipients.records.every((r) => r.at === NOW)).toBe(true)
    })

    it("someone the bot cannot reach is counted and never written to again", async () => {
        sender.blocked.add(2)
        expect(await press("owner")).toMatchObject({ sent: 1, unreachable: 1, left: 0 })
        expect(await press("owner")).toMatchObject({ sent: 0, unreachable: 0 })
        expect(recipients.records.find((r) => r.recipient.telegramId === 2)?.outcome).toBe(
            "unreachable",
        )
    })

    it("a customer's guide goes with their shop; Telegram down keeps what went out", async () => {
        recipients.people.customer.push({ telegramId: 501, businessId: "biz-2" })
        sender.failOn = 501
        await expect(press("customer")).rejects.toThrow("Telegram is down")
        // The first went out and stays sent; the second is tried again on the next press.
        expect(sender.sent).toEqual([
            { audience: "customer", recipient: { telegramId: 500, businessId: "biz-1" } },
        ])
        sender.failOn = null
        expect(await press("customer")).toMatchObject({ sent: 1, left: 0 })
    })

    it("only an admin sees the counts and sends", async () => {
        const status = await new GuideStatusUseCase(deps).execute({ actorTelegramId: ADMIN_TG })
        expect(status).toEqual([
            { audience: "owner", total: 2, left: 2 },
            { audience: "courier", total: GUIDE_BATCH + 5, left: GUIDE_BATCH + 5 },
            { audience: "customer", total: 1, left: 1 },
        ])
        await expect(
            new GuideStatusUseCase(deps).execute({ actorTelegramId: OWNER_TG }),
        ).rejects.toThrow(ForbiddenError)
        await expect(
            new SendGuidesUseCase(deps).execute({ actorTelegramId: OWNER_TG, audience: "owner" }),
        ).rejects.toThrow(ForbiddenError)
        expect(sender.sent).toHaveLength(0)
    })
})
