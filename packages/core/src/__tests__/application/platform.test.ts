import { describe, expect, it } from "vitest"

import { ListPlatformShopsUseCase } from "../../application/use-cases/platform/platform.use-cases.js"
import { Customer } from "../../domain/entities/customer.js"
import { BusinessStatus } from "../../domain/enums/business-status.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { Language } from "../../domain/enums/language.js"
import { Phone } from "../../domain/value-objects/phone.js"
import { TelegramId } from "../../domain/value-objects/telegram-id.js"
import { NOON_MONDAY_UZ, OWNER_TG, makeBusiness } from "../fixtures.js"
import { InMemoryBusinesses, InMemoryCustomers, fixedClock } from "../in-memory.js"

const ADMIN_TG = 9999

describe("«Platforma»: the admin's lists", () => {
    async function setup(): Promise<ListPlatformShopsUseCase> {
        const businesses = new InMemoryBusinesses()
        const customers = new InMemoryCustomers()
        await businesses.save(makeBusiness({ id: "live" }))
        await businesses.save(makeBusiness({ id: "applied", active: false }))
        const owner = Customer.register({
            id: "owner",
            telegramId: TelegramId.create(OWNER_TG),
            name: "Rustam",
            language: Language.UZ,
        })
        owner.setPhone(Phone.create("+998901112233"))
        await customers.save(owner)
        return new ListPlatformShopsUseCase(
            businesses,
            customers,
            [ADMIN_TG],
            fixedClock(NOON_MONDAY_UZ),
        )
    }

    it("applications and live shops, each with its owner, never the card", async () => {
        const list = await setup()
        const applications = await list.execute({
            actorTelegramId: ADMIN_TG,
            status: BusinessStatus.PENDING,
        })
        expect(applications.map((shop) => shop.id)).toEqual(["applied"])
        const [live] = await list.execute({
            actorTelegramId: ADMIN_TG,
            status: BusinessStatus.ACTIVE,
        })
        expect(live?.id).toBe("live")
        expect(live?.ownerTelegramId).toBe(OWNER_TG)
        expect(live?.owner.name).toBe("Rustam")
        expect(live?.owner.phone).toMatch(/^\+998/)
        expect(live).not.toHaveProperty("payoutCard")
    })

    it("an owner nobody knows yet shows without a name", async () => {
        const businesses = new InMemoryBusinesses()
        await businesses.save(makeBusiness({ active: false }))
        const list = new ListPlatformShopsUseCase(
            businesses,
            new InMemoryCustomers(),
            [ADMIN_TG],
            fixedClock(NOON_MONDAY_UZ),
        )
        const [shop] = await list.execute({
            actorTelegramId: ADMIN_TG,
            status: BusinessStatus.PENDING,
        })
        expect(shop?.owner).toEqual({ name: undefined, phone: undefined })
    })

    it("only a platform admin sees them", async () => {
        const list = await setup()
        await expect(
            list.execute({ actorTelegramId: OWNER_TG, status: BusinessStatus.PENDING }),
        ).rejects.toThrow(ForbiddenError)
    })
})
